# 👜 Kanini Bags — M-Pesa STK Push

A single-page bag store with **real M-Pesa STK Push** payments via Safaricom's
Daraja API, backed by a small PHP API.

## 🏗 How it works

```
Browser  ──POST api/stk_push.php──>  PHP  ──> Daraja ──> PIN prompt on phone
                                      ^                       │
Browser  <──GET api/status.php────    │                       │ customer enters PIN
                                      └──POST api/callback.php┘
```

The browser never talks to Safaricom directly — Daraja sends no CORS headers, and
the consumer secret must never reach client-side code. PHP holds the credentials,
sends the push, and receives the result on a public callback URL.

**The PIN is entered on the phone, not in the page.** Safaricom prompts the SIM
directly and never sends the PIN to your app. Any web page asking for an M-Pesa
PIN is phishing — this one doesn't.

## 📁 Layout

```
public/
  index.html          Markup
  css/styles.css      Styling
  js/app.js           Frontend logic
  api/
    config.php        Credentials (gitignored)
    config.example.php
    mpesa.php         Shared helpers
    stk_push.php      Starts a payment
    callback.php      Safaricom posts the result here
    status.php        Browser polls this
    data/             Payment records (gitignored, web-blocked)
archive/              Earlier versions, kept for reference
```

## 🚀 Setup (XAMPP)

**1. Put the project where Apache can serve it**

Copy this folder into `C:\xampp\htdocs\`, then start **Apache** from the XAMPP
Control Panel. Check it loads at <http://localhost/projec/public/>.

**2. Add your credentials**

```bash
cp public/api/config.example.php public/api/config.php
```

Fill in the values from <https://developer.safaricom.co.ke> → My Apps:

| Setting | Where it comes from |
|---|---|
| `consumer_key` / `consumer_secret` | Your app's page on the Daraja portal |
| `shortcode` | `174379` for sandbox |
| `passkey` | APIs → M-Pesa Express → Simulate |
| `callback_base` | Your ngrok URL + path to `api` (see below) |

`config.php` is gitignored. Never commit it.

**3. Fix PHP's CA bundle — do this before anything else**

XAMPP ships without a CA bundle, so cURL cannot verify Safaricom's certificate
and every call fails with `SSL certificate problem`. Download
[cacert.pem](https://curl.se/ca/cacert.pem) to `C:\xampp\php\extras\ssl\cacert.pem`,
then in `C:\xampp\php\php.ini` set:

```ini
curl.cainfo = "C:\xampp\php\extras\ssl\cacert.pem"
openssl.cafile = "C:\xampp\php\extras\ssl\cacert.pem"
```

Restart Apache.

> Most tutorials tell you to "fix" this with `CURLOPT_SSL_VERIFYPEER => false`.
> **Don't.** That disables certificate checking entirely and lets anyone on the
> network read or alter your payment traffic. Install the CA bundle instead.

**4. Expose the callback**

Safaricom POSTs the result to a public HTTPS URL — `localhost` will not work.

```bash
ngrok http 80
```

Put the resulting URL **plus the path to the api folder** in `config.php`:

```php
'callback_base' => 'https://a1b2-x-x.ngrok-free.app/projec/public/api',
```

**This URL changes every time ngrok restarts.** Update `config.php` when it does,
or callbacks vanish and payments hang forever.

## 🧪 Testing

1. Open <http://localhost/projec/public/>
2. Add a bag → Cart → Checkout
3. Enter a name and a **Safaricom** number (`07XX XXX XXX`)
4. Pay with M-Pesa → a PIN prompt appears on that phone
5. Enter the PIN. The page polls until the callback confirms.

Sandbox moves no real money.

**Result codes:** `0` success · `1` insufficient balance · `1032` cancelled by
user · `1037` timeout / phone unreachable · `2001` wrong PIN.

**Safaricom's test number** `254708374149` never reaches a real handset — useful
for checking a push is accepted without bothering anyone, but it can't confirm.

## ⚠️ Known limits

- **Daraja sandbox allows 5 requests/minute.** `status.php` therefore queries
  Safaricom at most once every 20s per payment and serves the browser from a
  local file in between. Polling harder gets you throttled.
- **The browser sends the amount.** Someone could edit it before checkout. Before
  going live, keep the cart server-side and compute the total there.
- **Products and orders live in localStorage**, so they're per-browser.
  `data/payments.json` is the only server-side state.
- Going live: set `env` to `production` and swap in your real shortcode, passkey
  and Go-Live credentials.
