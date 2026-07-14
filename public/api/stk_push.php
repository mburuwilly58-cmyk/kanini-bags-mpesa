<?php
// POST {phone, amount} -> triggers the M-Pesa PIN prompt on the customer's phone.

declare(strict_types=1);
require __DIR__ . '/mpesa.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_fail('POST only.', 405);
}

$cfg = mpesa_config();

if (empty($cfg['callback_base'])) {
    json_fail('callback_base is not set in config.php. Run ngrok and paste the https URL there.', 500);
}

$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) {
    json_fail('Expected a JSON body.');
}

$phone = normalize_phone($in['phone'] ?? '');
if ($phone === null) {
    json_fail('Invalid phone number. Use 07XX XXX XXX.');
}

// Daraja rejects non-integer amounts. Sandbox caps at 150,000.
$amount = (int) floor((float) ($in['amount'] ?? 0));
if ($amount < 1 || $amount > 150000) {
    json_fail('Amount must be between 1 and 150000.');
}

try {
    $ts    = mpesa_timestamp();
    $token = mpesa_token($cfg);

    $payload = [
        'BusinessShortCode' => $cfg['shortcode'],
        'Password'          => mpesa_password($cfg, $ts),
        'Timestamp'         => $ts,
        'TransactionType'   => 'CustomerPayBillOnline',
        'Amount'            => $amount,
        'PartyA'            => $phone,
        'PartyB'            => $cfg['shortcode'],
        'PhoneNumber'       => $phone,
        'CallBackURL'       => rtrim($cfg['callback_base'], '/') . '/callback.php',
        'AccountReference'  => substr($cfg['account_ref'] ?? 'Kanini Bags', 0, 12),
        'TransactionDesc'   => 'Bag Purchase',
    ];

    $r    = http_post_json(mpesa_base_url($cfg) . '/mpesa/stkpush/v1/processrequest', $payload, ["Authorization: Bearer $token"]);
    $body = $r['body'];

    if (($body['ResponseCode'] ?? null) !== '0') {
        json_fail($body['errorMessage'] ?? $body['CustomerMessage'] ?? 'STK push rejected by Safaricom.');
    }

    $id = $body['CheckoutRequestID'];
    payment_put($id, [
        'status'     => 'PENDING',
        'amount'     => $amount,
        'phone'      => $phone,
        'created_at' => time(),
    ]);

    json_out([
        'ok'                => true,
        'checkoutRequestId' => $id,
        'customerMessage'   => $body['CustomerMessage'] ?? '',
    ]);
} catch (Throwable $e) {
    error_log('STK push error: ' . $e->getMessage());
    json_fail($e->getMessage(), 500);
}
