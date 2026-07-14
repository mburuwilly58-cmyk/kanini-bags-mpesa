# Running this on another machine

Start to finish, from a clean pull. Roughly 15 minutes.

## 0. What this repo is

The **purple bag store** with M-Pesa STK Push and customer accounts.

It is **not** the orange `kanini-sales` admin dashboard. That is a separate app
that is not in this repo. Both read the same `kanini_sales` database, but pulling
this repo will not give you kanini-sales.

## 1. Requirements

- **XAMPP** with Apache + MySQL ([download](https://www.apachefriends.org/))
- **ngrok** ([download](https://ngrok.com/download)) — only needed for payments
- Git

## 2. Pull

Clone into XAMPP's web root so Apache can serve it:

```bash
cd C:\xampp\htdocs
git clone https://github.com/mburuwilly58-cmyk/kanini-bags-mpesa.git kanini-bags
```

Already cloned elsewhere? Just `git pull`, but it must sit under `htdocs` to be served.

## 3. Fix PHP's CA bundle — do this first

XAMPP ships **without** a CA bundle, so PHP cannot verify Safaricom's
certificate and every payment fails with `SSL certificate problem`. This
catches everyone.

1. Download <https://curl.se/ca/cacert.pem>
2. Save it to `C:\xampp\php\extras\ssl\cacert.pem`
3. Open `C:\xampp\php\php.ini` and set:

```ini
curl.cainfo = "C:\xampp\php\extras\ssl\cacert.pem"
openssl.cafile = "C:\xampp\php\extras\ssl\cacert.pem"
```

4. Restart Apache from the XAMPP Control Panel.

> Guides all over the internet say to "fix" this with
> `CURLOPT_SSL_VERIFYPEER => false`. **Don't.** That turns off certificate
> checking entirely, so anyone on the network can read or alter your payment
> traffic. Install the bundle.

## 4. Configure

```bash
cd C:\xampp\htdocs\kanini-bags
copy public\api\config.example.php public\api\config.php
```

Edit `public/api/config.php`:

| Setting | Value |
|---|---|
| `consumer_key`, `consumer_secret` | From <https://developer.safaricom.co.ke> → My Apps |
| `shortcode` | `174379` for sandbox |
| `passkey` | APIs → M-Pesa Express → Simulate |
| `callback_base` | Your ngrok URL (step 6) |
| `db` | XAMPP defaults — `127.0.0.1`, port `3306`, user `root`, empty password |

`config.php` is gitignored. It never gets committed, which is why you have to
create it on each machine.

## 4b. The one file git will never give you

`public/api/config.php` is **gitignored on purpose** — it holds your Daraja
secrets, your database password and the admin hash. Anything committed to a
public repo is readable by everyone, and git history keeps it even after you
change the value. So it does not exist after a clone: you create it by hand on
every machine.

Everything else arrives with `git pull`. This one file is the only manual step.
`config.example.php` is the tracked template showing every key with placeholders.

## 5. Check your setup

Start **Apache** and **MySQL** in XAMPP, then open:

<http://localhost/kanini-bags/public/api/setup_check.php>

It checks PHP extensions, the CA bundle, your config, database connectivity, the
`users` table, and your password hashes — and prints the fix for anything broken.
**Get this to pass before going further.** It'll save you an hour of guessing.

## 6. Expose the callback (payments only)

Safaricom POSTs results to a public HTTPS URL. `localhost` will never work.

```bash
ngrok http 80
```

Copy the `https://` forwarding URL into `config.php`, including the path:

```php
'callback_base' => 'https://a1b2-x-x.ngrok-free.app/kanini-bags/public/api',
```

**This URL changes every time ngrok restarts.** Update `config.php` and reload,
or callbacks go nowhere and payments hang on "waiting for PIN" forever.

## 7. Run

Open <http://localhost/kanini-bags/public/>

1. **Sign Up** — name, email, Safaricom phone, 8+ char password
2. Add a bag to the cart (sign-in is required)
3. Checkout → Pay with M-Pesa
4. A PIN prompt appears on that phone — enter your PIN
5. The page polls until the callback confirms

Sandbox moves no real money.

## Admin

Sign in with the email and password set in `config.php` under `admin`. A gold
**Admin** link then appears in the navbar.

The dashboard shows revenue (completed payments only), paid / pending / failed
counts, every M-Pesa transaction with its receipt and basket, and your customers
from the `users` table.

**Change the admin password before this leaves your laptop.** Generate a hash:

```
C:\xampp\php\php.exe -r "echo password_hash('your-new-password', PASSWORD_BCRYPT);"
```

Paste it into `config.php` under `admin` -> `password_hash`. Store the hash,
never the password.

The admin authenticates against `config.php`, so it works even if the `users`
table has no admin row. Customers and guests get a 403 from
`api/admin_data.php` no matter what the page shows.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `SSL certificate problem` | CA bundle — step 3 |
| `Cannot reach the database` | MySQL isn't started, or the `db` block is wrong |
| `callback_base is not set` | Step 6 |
| `Please sign in to pay` | Working as intended — sign in first |
| PIN prompt appears but page never confirms | Stale ngrok URL in `config.php` |
| `This account needs a password reset` | That user's hash is truncated — see below |
| Spike arrest / HTTP 429 | Daraja allows 5 requests/min. Wait a minute. |
| `Admin access required` | Sign in with the `admin` email from `config.php` |
| Admin shows no transactions | None yet — they appear as soon as a customer pays |

### Accounts that can't log in

A bcrypt hash is always exactly 60 characters. Some rows in `users` store
47-character hashes — truncated at some point, and unrecoverable. Those accounts
cannot log in with **any** password. `setup_check.php` lists them by email. Find
them with:

```sql
SELECT email, LENGTH(password) FROM users WHERE LENGTH(password) <> 60;
```

The only fix is to set a new password. From this repo's directory:

```bash
php -r "echo password_hash('the-new-password', PASSWORD_BCRYPT), PHP_EOL;"
```

Then in phpMyAdmin:

```sql
UPDATE users SET password = '<paste the hash>' WHERE email = 'admin@kanini.co.ke';
```

## Before this goes anywhere public

- Delete `public/api/setup_check.php` — it reports environment details.
- The browser sends the cart total. Move the cart server-side and compute
  totals there, or a customer can pay any amount they like.
- Set `env` to `production` in config and swap in Go-Live credentials.
