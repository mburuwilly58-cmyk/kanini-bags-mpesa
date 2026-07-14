<?php
// POST {name, email, phone, password, address?} -> creates a 'client' account.

declare(strict_types=1);
require __DIR__ . '/db.php';

require_post();
$in = json_body();

$name  = trim((string) ($in['name'] ?? ''));
$email = strtolower(trim((string) ($in['email'] ?? '')));
$pass  = (string) ($in['password'] ?? '');
$addr  = trim((string) ($in['address'] ?? ''));

// users.phone is NOT NULL, and we need a real Safaricom number for STK push anyway.
$phone = normalize_phone($in['phone'] ?? '');

if ($name === '' || $email === '' || $pass === '') {
    json_fail('Name, email and password are required.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_fail('That email address does not look valid.');
}
if ($phone === null) {
    json_fail('Enter a valid Safaricom phone number (07XX XXX XXX).');
}
if (strlen($pass) < 8) {
    json_fail('Password must be at least 8 characters.');
}

// Column widths are hard limits — MySQL would otherwise truncate silently and
// store something the user never typed.
if (mb_strlen($name) > 100)  json_fail('Name is too long (max 100).');
if (mb_strlen($email) > 100) json_fail('Email is too long (max 100).');
if (mb_strlen($addr) > 255)  json_fail('Address is too long (max 255).');

try {
    $pdo  = db();
    $hash = password_hash($pass, PASSWORD_BCRYPT);
    $id   = new_user_id();

    // Only the NOT NULL columns plus address. role, customer_tier, language,
    // theme, loyalty_points, total_spent and created_at all have defaults.
    $st = $pdo->prepare(
        'INSERT INTO users (id, name, email, phone, address, password) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $st->execute([$id, $name, $email, $phone, $addr, $hash]);
} catch (PDOException $e) {
    // 23000 = integrity constraint. email has a UNIQUE key.
    if ($e->getCode() === '23000') {
        json_fail('That email is already registered. Try signing in.');
    }
    error_log('Signup failed: ' . $e->getMessage());
    json_fail('Could not create the account.', 500);
}

auth_session_start();
session_regenerate_id(true);
$_SESSION['uid'] = $id;

json_out([
    'ok'   => true,
    'user' => ['id' => $id, 'name' => $name, 'email' => $email, 'phone' => $phone, 'address' => $addr, 'role' => 'client'],
]);
