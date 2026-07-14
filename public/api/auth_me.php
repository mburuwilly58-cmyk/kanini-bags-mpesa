<?php
// GET -> the signed-in user, or {ok:true, user:null} when signed out.
// The page calls this on load to decide what the navbar shows.

declare(strict_types=1);
require __DIR__ . '/db.php';

json_out(['ok' => true, 'user' => current_user()]);
