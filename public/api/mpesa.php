<?php
// Shared M-Pesa (Daraja) helpers. Not a route — included by the endpoints.

declare(strict_types=1);

function mpesa_config(): array
{
    $path = __DIR__ . '/config.php';
    if (!file_exists($path)) {
        json_fail('config.php is missing. Copy config.example.php to config.php and fill it in.', 500);
    }
    $cfg = require $path;

    foreach (['consumer_key', 'consumer_secret', 'shortcode', 'passkey'] as $k) {
        if (empty($cfg[$k]) || str_starts_with((string) $cfg[$k], 'your_')) {
            json_fail("config.php is missing a value for '$k'.", 500);
        }
    }
    return $cfg;
}

function mpesa_base_url(array $cfg): string
{
    return ($cfg['env'] ?? 'sandbox') === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
}

function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function json_fail(string $msg, int $code = 400): void
{
    json_out(['ok' => false, 'error' => $msg], $code);
}

// Daraja wants YYYYMMDDHHmmss in East Africa Time, not UTC or server-local time.
function mpesa_timestamp(): string
{
    return (new DateTime('now', new DateTimeZone('Africa/Nairobi')))->format('YmdHis');
}

function mpesa_password(array $cfg, string $timestamp): string
{
    return base64_encode($cfg['shortcode'] . $cfg['passkey'] . $timestamp);
}

// Accepts 07XXXXXXXX, 7XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX -> 2547XXXXXXXX.
// Returns null if it isn't a valid Safaricom number.
function normalize_phone($input): ?string
{
    $p = preg_replace('/[^0-9]/', '', (string) $input);
    if ($p === '') {
        return null;
    }
    if (str_starts_with($p, '0')) {
        $p = '254' . substr($p, 1);
    } elseif (preg_match('/^[17][0-9]{8}$/', $p)) {
        $p = '254' . $p;
    }
    return preg_match('/^254[17][0-9]{8}$/', $p) ? $p : null;
}

function http_post_json(string $url, array $body, array $headers): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body),
        CURLOPT_HTTPHEADER     => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_TIMEOUT        => 30,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($res === false) {
        throw new RuntimeException("Network error contacting Safaricom: $err");
    }
    $decoded = json_decode($res, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Safaricom returned a non-JSON response: ' . substr((string) $res, 0, 200));
    }
    return ['status' => $code, 'body' => $decoded];
}

// Tokens last ~3600s. Cache to disk and refresh a minute early to avoid racing expiry.
function mpesa_token(array $cfg): string
{
    $cacheFile = __DIR__ . '/data/token.json';
    if (file_exists($cacheFile)) {
        $c = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($c) && ($c['expires_at'] ?? 0) > time() && !empty($c['token'])) {
            return $c['token'];
        }
    }

    $url = mpesa_base_url($cfg) . '/oauth/v1/generate?grant_type=client_credentials';
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Basic ' . base64_encode($cfg['consumer_key'] . ':' . $cfg['consumer_secret']),
        ],
        CURLOPT_TIMEOUT => 30,
    ]);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($res === false) {
        throw new RuntimeException("Network error getting token: $err");
    }
    $d = json_decode((string) $res, true);
    if (!is_array($d) || empty($d['access_token'])) {
        throw new RuntimeException('Auth failed: ' . substr((string) $res, 0, 200));
    }

    store_write($cacheFile, [
        'token'      => $d['access_token'],
        'expires_at' => time() + max(60, (int) ($d['expires_in'] ?? 3600) - 60),
    ]);
    return $d['access_token'];
}

// ── Payment store (flat JSON file) ────────────────────────────────────────────
// Keyed by CheckoutRequestID. Locked on write so a callback landing at the same
// moment as a status poll cannot corrupt the file.

function store_path(): string
{
    return __DIR__ . '/data/payments.json';
}

function store_write(string $path, array $data): void
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
}

function payments_all(): array
{
    $p = store_path();
    if (!file_exists($p)) {
        return [];
    }
    $d = json_decode((string) file_get_contents($p), true);
    return is_array($d) ? $d : [];
}

function payment_get(string $id): ?array
{
    return payments_all()[$id] ?? null;
}

function payment_put(string $id, array $record): void
{
    $all      = payments_all();
    $all[$id] = array_merge($all[$id] ?? [], $record);
    store_write(store_path(), $all);
}
