<?php
// Safaricom POSTs the final payment result here.
// Must be publicly reachable over HTTPS — localhost will never work.

declare(strict_types=1);
require __DIR__ . '/mpesa.php';

$raw = (string) file_get_contents('php://input');

// Acknowledge immediately. Safaricom retries on anything that isn't a 200,
// regardless of whether we understood the payload.
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);

// Keep the connection from holding open while we write to disk.
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}

$in = json_decode($raw, true);
$cb = $in['Body']['stkCallback'] ?? null;

if (!is_array($cb)) {
    error_log('M-Pesa callback with unexpected shape: ' . substr($raw, 0, 500));
    exit;
}

$id         = (string) ($cb['CheckoutRequestID'] ?? '');
$resultCode = (string) ($cb['ResultCode'] ?? '');
$resultDesc = (string) ($cb['ResultDesc'] ?? '');

if ($id === '') {
    error_log('M-Pesa callback without CheckoutRequestID');
    exit;
}

// CallbackMetadata is only present on success.
$items = [];
foreach ($cb['CallbackMetadata']['Item'] ?? [] as $item) {
    if (isset($item['Name'])) {
        $items[$item['Name']] = $item['Value'] ?? null;
    }
}

$record = [
    'status'       => $resultCode === '0' ? 'SUCCESS' : 'FAILED',
    'result_code'  => $resultCode,
    'result_desc'  => $resultDesc,
    'receipt'      => $items['MpesaReceiptNumber'] ?? null,
    'completed_at' => time(),
];
if (isset($items['Amount'])) {
    $record['amount'] = $items['Amount'];
}
if (isset($items['PhoneNumber'])) {
    $record['phone'] = (string) $items['PhoneNumber'];
}

payment_put($id, $record);
error_log("M-Pesa callback $id: {$record['status']} " . ($record['receipt'] ?? $resultDesc));
