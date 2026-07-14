<?php
// GET -> everything the admin dashboard renders.
// Transactions come from data/payments.json (server-side, so every customer's
// payment is visible). Customers come from the users table.

declare(strict_types=1);
require __DIR__ . '/db.php';

require_admin();

$payments = payments_all();

$tx = [];
foreach ($payments as $id => $p) {
    $tx[] = [
        'id'       => $id,
        'status'   => $p['status'] ?? 'PENDING',
        'amount'   => (float) ($p['amount'] ?? 0),
        'phone'    => $p['phone'] ?? '',
        'customer' => $p['customer_name'] ?? '',
        'email'    => $p['customer_email'] ?? '',
        'receipt'  => $p['receipt'] ?? null,
        'reason'   => $p['result_desc'] ?? null,
        'items'    => $p['items'] ?? [],
        'created'  => (int) ($p['created_at'] ?? 0),
    ];
}

// Newest first.
usort($tx, static fn($a, $b) => $b['created'] <=> $a['created']);

$succeeded = array_filter($tx, static fn($t) => $t['status'] === 'SUCCESS');

$stats = [
    // Only completed payments count as revenue. Counting PENDING would inflate
    // it with prompts nobody ever confirmed.
    'revenue'   => array_sum(array_map(static fn($t) => $t['amount'], $succeeded)),
    'paid'      => count($succeeded),
    'pending'   => count(array_filter($tx, static fn($t) => $t['status'] === 'PENDING')),
    'failed'    => count(array_filter($tx, static fn($t) => $t['status'] === 'FAILED')),
    'total'     => count($tx),
];

$customers = [];
try {
    $rows = db()->query(
        'SELECT id, name, email, phone, customer_tier, loyalty_points, total_spent, created_at
         FROM users WHERE role = \'client\' ORDER BY created_at DESC LIMIT 200'
    )->fetchAll();
    $customers   = $rows;
    $stats['customers'] = count($rows);
} catch (Throwable $e) {
    error_log('Admin customer load failed: ' . $e->getMessage());
    $stats['customers'] = null;   // null = "couldn't read", not "zero"
}

json_out([
    'ok'           => true,
    'stats'        => $stats,
    'transactions' => $tx,
    'customers'    => $customers,
]);
