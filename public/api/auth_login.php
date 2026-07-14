<?php
// POST {email, password} -> starts a session.

declare(strict_types=1);
require __DIR__ . '/db.php';

require_post();
$in = json_body();

$email = strtolower(trim((string) ($in['email'] ?? '')));
$pass  = (string) ($in['password'] ?? '');

if ($email === '' || $pass === '') {
    json_fail('Email and password are required.');
}

$st = db()->prepare('SELECT id, name, email, phone, address, role, password FROM users WHERE email = ?');
$st->execute([$email]);
$user = $st->fetch();

// Same message whether the email is unknown or the password is wrong. Saying
// "no such account" would let anyone enumerate who has registered.
$generic = 'Incorrect email or password.';

if (!$user) {
    // Spend roughly the time a real verify would, so response timing doesn't
    // reveal whether the account exists.
    password_verify($pass, '$2y$10$usesomesillystringforeLQKRuf7pGZC0G6HdGGGZI3fkKfLuTFy');
    json_fail($generic, 401);
}

// A bcrypt hash is always 60 chars. Some rows in this table are 47 — truncated
// at some point and unrecoverable. password_verify() returns false for those no
// matter what is typed, which looks like "wrong password" forever. Log it so it
// is diagnosable instead of mysterious.
if (strlen($user['password']) !== 60 || !str_starts_with($user['password'], '$2y$')) {
    error_log("Login blocked: user {$user['id']} has a malformed password hash (" . strlen($user['password']) . " chars). Needs a password reset.");
    json_fail('This account needs a password reset. Please contact support.', 401);
}

if (!password_verify($pass, $user['password'])) {
    json_fail($generic, 401);
}

// Cost may have been raised since this hash was written.
if (password_needs_rehash($user['password'], PASSWORD_BCRYPT)) {
    $up = db()->prepare('UPDATE users SET password = ? WHERE id = ?');
    $up->execute([password_hash($pass, PASSWORD_BCRYPT), $user['id']]);
}

auth_session_start();
session_regenerate_id(true);   // new id on privilege change — blocks session fixation
$_SESSION['uid'] = $user['id'];

unset($user['password']);
json_out(['ok' => true, 'user' => $user]);
