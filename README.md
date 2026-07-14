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

## 🚀 Setup

See **[SETUP.md](SETUP.md)** — full step-by-step for a fresh machine, plus
troubleshooting.

Once running, open `api/setup_check.php` in a browser. It verifies PHP
extensions, the CA bundle, config, database and password hashes, and prints the
fix for anything broken.

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
