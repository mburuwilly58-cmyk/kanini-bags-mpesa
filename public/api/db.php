<?php
// MySQL connection + session bootstrap. Included by the auth endpoints.

declare(strict_types=1);
require_once __DIR__ . '/mpesa.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = mpesa_config();
    $db  = $cfg['db'] ?? [];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $db['host'] ?? '127.0.0.1',
        (int) ($db['port'] ?? 3306),
        $db['name'] ?? 'kanini_sales'
    );

    try {
        $pdo = new PDO($dsn, $db['user'] ?? 'root', $db['pass'] ?? '', [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Real prepared statements, not client-side interpolation.
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        error_log('DB connection failed: ' . $e->getMessage());
        json_fail('Cannot reach the database. Is MySQL running?', 500);
    }
    return $pdo;
}

function auth_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'httponly' => true,                                   // not readable from JS
        'samesite' => 'Lax',                                  // blocks cross-site POSTs
        'secure'   => !empty($_SERVER['HTTPS']),              // HTTPS-only when available
    ]);
    session_start();
}

function is_admin(): bool
{
    auth_session_start();
    return !empty($_SESSION['is_admin']);
}

// Every admin endpoint calls this first. Without it the pages are just URLs
// anyone could request.
function require_admin(): void
{
    if (!is_admin()) {
        json_fail('Admin access required.', 403);
    }
}

function current_user(): ?array
{
    auth_session_start();

    // The admin isn't a users row — it comes from config.php.
    if (!empty($_SESSION['is_admin'])) {
        return [
            'id' => 'admin', 'name' => 'Administrator',
            'email' => (string) ($_SESSION['admin_email'] ?? ''),
            'phone' => '', 'address' => '', 'role' => 'admin',
            'customer_tier' => null, 'loyalty_points' => 0,
        ];
    }

    if (empty($_SESSION['uid'])) {
        return null;
    }
    $st = db()->prepare('SELECT id, name, email, phone, address, role, customer_tier, loyalty_points FROM users WHERE id = ?');
    $st->execute([$_SESSION['uid']]);
    $u = $st->fetch();
    return $u ?: null;
}

function require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        json_fail('POST only.', 405);
    }
}

function json_body(): array
{
    $in = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($in)) {
        json_fail('Expected a JSON body.');
    }
    return $in;
}

// id is varchar(50) with no default, so we generate it. Random rather than
// sequential so user ids aren't guessable or countable from the outside.
function new_user_id(): string
{
    return 'usr_' . bin2hex(random_bytes(12));
}
