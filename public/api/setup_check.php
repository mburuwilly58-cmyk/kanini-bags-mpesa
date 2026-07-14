<?php
// Open this in a browser to see what's configured and what isn't.
// Every failure here has a fix printed next to it.
//
// Delete or block this file before putting the site on a public server —
// it reports environment details that are useful to an attacker.

declare(strict_types=1);
header('Content-Type: text/plain; charset=utf-8');

$pass = 0;
$fail = 0;

function check(string $label, bool $ok, string $detail = '', string $fix = ''): void
{
    global $pass, $fail;
    $ok ? $pass++ : $fail++;
    printf("[%s] %s%s\n", $ok ? ' OK ' : 'FAIL', $label, $detail !== '' ? "  ($detail)" : '');
    if (!$ok && $fix !== '') {
        echo "       -> $fix\n";
    }
}

echo "Kanini Bags — setup check\n";
echo str_repeat('=', 60), "\n\n";

echo "PHP\n";
check('PHP 8.0+', PHP_VERSION_ID >= 80000, PHP_VERSION, 'Upgrade PHP. XAMPP 8.x ships a recent build.');
check('curl extension', extension_loaded('curl'), '', 'Uncomment extension=curl in php.ini, restart Apache.');
check('pdo_mysql extension', extension_loaded('pdo_mysql'), '', 'Uncomment extension=pdo_mysql in php.ini, restart Apache.');
check('openssl extension', extension_loaded('openssl'), '', 'Uncomment extension=openssl in php.ini, restart Apache.');

echo "\nSSL (needed to reach Safaricom)\n";
$cainfo = ini_get('curl.cainfo') ?: ini_get('openssl.cafile');
check('CA bundle configured', !empty($cainfo) && file_exists($cainfo), $cainfo ?: 'not set',
    'Download https://curl.se/ca/cacert.pem, then set curl.cainfo and openssl.cafile to its path in php.ini. Do NOT disable SSL verification instead.');

echo "\nConfig\n";
$cfgPath = __DIR__ . '/config.php';
$hasCfg  = file_exists($cfgPath);
check('config.php exists', $hasCfg, '', 'cp config.example.php config.php and fill it in.');

$cfg = $hasCfg ? require $cfgPath : [];
if ($hasCfg) {
    foreach (['consumer_key', 'consumer_secret', 'shortcode', 'passkey'] as $k) {
        $v = (string) ($cfg[$k] ?? '');
        check("$k set", $v !== '' && !str_starts_with($v, 'your_'), '', "Fill in '$k' in config.php from the Daraja portal.");
    }
    check('callback_base set', !empty($cfg['callback_base']), (string) ($cfg['callback_base'] ?? ''),
        'Run `ngrok http 80`, then paste the https URL + path to this api folder into callback_base.');
}

echo "\nWritable storage\n";
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0775, true);
}
check('api/data is writable', is_dir($dataDir) && is_writable($dataDir), $dataDir, 'Give the web server write permission on api/data.');

echo "\nDatabase\n";
if ($hasCfg) {
    $db = $cfg['db'] ?? [];
    try {
        $pdo = new PDO(
            sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $db['host'] ?? '127.0.0.1', (int) ($db['port'] ?? 3306), $db['name'] ?? 'kanini_sales'),
            $db['user'] ?? 'root',
            $db['pass'] ?? '',
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        check('connected', true, ($db['name'] ?? '?') . ' @ ' . ($db['host'] ?? '?') . ':' . ($db['port'] ?? 3306));

        $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
        check('users table reachable', true, count($cols) . ' columns');

        foreach (['id', 'name', 'email', 'phone', 'password', 'role'] as $need) {
            check("users.$need exists", in_array($need, $cols, true), '', "This app expects a '$need' column on users.");
        }

        // A bcrypt hash is always exactly 60 chars. Anything else cannot be
        // verified and locks that account out permanently.
        $rows = $pdo->query("SELECT email, LENGTH(password) AS len FROM users ORDER BY email")->fetchAll(PDO::FETCH_ASSOC);
        $bad  = array_filter($rows, static fn($r) => (int) $r['len'] !== 60);
        check('all password hashes are valid bcrypt (60 chars)', count($bad) === 0, count($bad) . ' of ' . count($rows) . ' broken',
            'These accounts cannot log in with any password and must have their passwords reset:');
        foreach ($bad as $b) {
            echo "          - {$b['email']} ({$b['len']} chars)\n";
        }
    } catch (Throwable $e) {
        check('connected', false, $e->getMessage(), 'Start MySQL in XAMPP, and check the db block in config.php.');
    }
}

echo "\n", str_repeat('=', 60), "\n";
printf("%d passed, %d failed\n", $pass, $fail);
echo $fail === 0
    ? "\nReady. Open the store and try a payment.\n"
    : "\nFix the FAIL lines above, then reload this page.\n";
