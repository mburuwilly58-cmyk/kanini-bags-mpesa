<?php
// Copy this file to config.php and fill in your values.
// config.php is gitignored — never commit it.
// Credentials come from https://developer.safaricom.co.ke -> My Apps

return [
    // 'sandbox' or 'production'
    'env' => 'sandbox',

    'consumer_key'    => 'your_consumer_key',
    'consumer_secret' => 'your_consumer_secret',

    // 174379 is the sandbox test shortcode
    'shortcode' => '174379',

    // APIs -> M-Pesa Express -> Simulate
    'passkey' => 'your_passkey',

    // Public HTTPS base URL Safaricom posts results to. No trailing slash.
    // Run `ngrok http 80` and paste the https URL here.
    // Must reach this folder, e.g. https://xxxx.ngrok-free.app/kanini/api
    'callback_base' => '',

    'account_ref' => 'Kanini Bags',

    // Admin login. Lives here rather than in the committed code because this
    // file is gitignored — anything in a tracked file is public on GitHub, and
    // git history keeps it even after a change.
    // New password: php -r "echo password_hash('yours', PASSWORD_BCRYPT);"
    'admin' => [
        'email'         => 'admin@kanini.co.ke',
        'password_hash' => 'paste_a_bcrypt_hash_here',
    ],

    // MySQL (XAMPP defaults: root / empty password)
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'kanini_sales',
        'user' => 'root',
        'pass' => '',
    ],
];
