# 👜 Kanini Bags — M-Pesa STK Push

A single-page e-commerce store with **real M-Pesa STK Push** payments via Safaricom's
Daraja API, backed by a small Express server.

## 🏗 How it works

```
Browser  ──POST /api/stk/push──>  Express  ──> Daraja  ──> PIN prompt on phone
                                     ^                          │
Browser  <──GET /api/stk/status──   │                          │ user enters PIN
                                     └──POST /api/stk/callback──┘
```

The browser never talks to Safaricom directly — Daraja sends no CORS headers, and the
consumer secret must never reach client-side code. The server holds the credentials,
proxies the push, and receives the result on a public callback URL.

## 📁 Layout

```
server.js            Express: serves the site + /api/stk/* endpoints
.env                 Credentials (gitignored — never commit)
public/
  index.html         Markup only
  css/styles.css     All styling
  js/app.js          All frontend logic
```

## 🚀 Setup

**1. Install dependencies**

```bash
npm install
```

**2. Configure credentials**

```bash
cp .env.example .env
```

Fill in the values from <https://developer.safaricom.co.ke> → My Apps:

| Variable | Where it comes from |
|---|---|
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | Your app's page on the Daraja portal |
| `MPESA_SHORTCODE` | `174379` for sandbox |
| `MPESA_PASSKEY` | APIs → M-Pesa Express → Simulate |
| `PUBLIC_BASE_URL` | Your ngrok HTTPS URL (see below) |

`.env` is gitignored. Never commit it.

**3. Expose a callback URL**

Safaricom POSTs the payment result to a public HTTPS URL — `localhost` will not work.
Install [ngrok](https://ngrok.com/download), then:

```bash
ngrok http 3000
```

Copy the `https://xxxx.ngrok-free.app` URL into `PUBLIC_BASE_URL` in `.env`.
**This URL changes every time ngrok restarts**, so update `.env` and restart the server.

**4. Run**

```bash
npm start
```

Open <http://localhost:3000>.

## 🧪 Testing

With the server and ngrok both running:

1. Browse bags → Add to cart → Proceed to Checkout
2. Enter name and phone `0746105098`
3. Click **Pay with M-Pesa**
4. A PIN prompt appears on the phone — enter the M-Pesa PIN
5. The page polls `/api/stk/status` and confirms once the callback lands

Sandbox uses no real money.

**Test the API directly:**

```bash
curl -X POST http://localhost:3000/api/stk/push \
  -H "Content-Type: application/json" \
  -d '{"phone":"0746105098","amount":1500}'
```

**Result codes you'll see:** `0` success · `1032` cancelled by user ·
`1037` timeout / no response · `2001` wrong PIN · `1` insufficient balance.

## 📡 API

| Endpoint | Purpose |
|---|---|
| `POST /api/stk/push` | `{phone, amount}` → triggers the PIN prompt |
| `POST /api/stk/callback` | Safaricom posts the final result here |
| `GET /api/stk/status/:id` | Poll payment status; falls back to STK Query |
| `GET /api/health` | Config sanity check |

## ⚠️ Before going live

- **Payment state is in-memory** — a restart loses in-flight payments. Use a database.
- **The client sends the amount.** A user could edit it before checkout. Real deployments
  must keep the cart server-side and compute the total there.
- **Products and orders live in localStorage**, so they're per-browser, not shared.
- Switch `MPESA_ENV=production` and swap in your real shortcode, passkey, and Go-Live
  credentials.

## 📦 Tech Stack

- Express 4 (ES modules), Node 18+
- Vanilla JS frontend, localStorage for store data
- No build step
