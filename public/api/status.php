<?php
// GET ?id=<CheckoutRequestID> -> current payment status.
// The browser polls this every few seconds while the customer enters their PIN.

declare(strict_types=1);
require __DIR__ . '/mpesa.php';

// Daraja sandbox enforces a spike arrest of 5 requests per minute across the
// app. The browser polls far faster than that, so serve from our own store and
// only fall back to Safaricom's query endpoint this often.
const QUERY_MIN_INTERVAL = 20;

// Don't bother querying before the customer has had time to see the prompt.
const QUERY_GRACE = 8;

$id = (string) ($_GET['id'] ?? '');
if ($id === '') {
    json_fail('Missing id.');
}

$record = payment_get($id);
if ($record === null) {
    json_fail('Unknown CheckoutRequestID.', 404);
}

$respond = static function (array $r): void {
    json_out([
        'ok'         => true,
        'status'     => $r['status'] ?? 'PENDING',
        'receipt'    => $r['receipt'] ?? null,
        'amount'     => $r['amount'] ?? null,
        'resultDesc' => $r['result_desc'] ?? null,
    ]);
};

// The callback is the source of truth. If it already landed, we're done.
if (($record['status'] ?? 'PENDING') !== 'PENDING') {
    $respond($record);
}

$now     = time();
$age     = $now - (int) ($record['created_at'] ?? $now);
$lastQ   = (int) ($record['last_query_at'] ?? 0);
$mayQuery = $age >= QUERY_GRACE && ($now - $lastQ) >= QUERY_MIN_INTERVAL;

if (!$mayQuery) {
    $respond($record);
}

// Fall back to querying Safaricom in case the callback was missed — a dead
// ngrok tunnel or a restart will do it.
try {
    payment_put($id, ['last_query_at' => $now]);

    $cfg   = mpesa_config();
    $ts    = mpesa_timestamp();
    $token = mpesa_token($cfg);

    $r = http_post_json(mpesa_base_url($cfg) . '/mpesa/stkpushquery/v1/query', [
        'BusinessShortCode' => $cfg['shortcode'],
        'Password'          => mpesa_password($cfg, $ts),
        'Timestamp'         => $ts,
        'CheckoutRequestID' => $id,
    ], ["Authorization: Bearer $token"]);

    $body = $r['body'];

    // Rate limited, or some other gateway fault. Not an answer about the
    // payment — stay pending and try again later.
    if (isset($body['fault'])) {
        error_log('STK query throttled: ' . ($body['fault']['faultstring'] ?? ''));
        $respond($record);
    }

    $code = (string) ($body['ResultCode'] ?? '');
    $desc = (string) ($body['ResultDesc'] ?? '');

    // While the prompt is still live, Safaricom answers either with errorCode
    // 500.001.1001 or a ResultDesc saying the transaction is still processing.
    // Both mean "not yet" — treating them as failure would tell a customer
    // their payment failed while it was still going through.
    $stillProcessing = ($body['errorCode'] ?? '') === '500.001.1001'
        || stripos($desc, 'processing') !== false;

    if (!$stillProcessing && $code !== '') {
        $updated = [
            'status'      => $code === '0' ? 'SUCCESS' : 'FAILED',
            'result_code' => $code,
            'result_desc' => $desc,
        ];
        payment_put($id, $updated);
        $respond(array_merge($record, $updated));
    }
} catch (Throwable $e) {
    // Query is only a fallback — never fail the request over it.
    error_log('STK query fallback failed: ' . $e->getMessage());
}

$respond($record);
