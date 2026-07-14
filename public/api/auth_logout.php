<?php
// POST -> ends the session.

declare(strict_types=1);
require __DIR__ . '/db.php';

require_post();
auth_session_start();

$_SESSION = [];

// Clearing $_SESSION alone leaves the cookie in place; expire it too.
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();

json_out(['ok' => true]);
