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
];
