import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  MPESA_ENV = 'sandbox',
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  PUBLIC_BASE_URL,
  PORT = 3000,
} = process.env;

const BASE_URL =
  MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

for (const [key, val] of Object.entries({
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
})) {
  if (!val) {
    console.error(`Missing ${key} in .env — copy .env.example and fill it in.`);
    process.exit(1);
  }
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Payment results keyed by CheckoutRequestID. In-memory: fine for sandbox,
// but a restart loses in-flight payments and this won't survive >1 instance.
const payments = new Map();

// Daraja tokens last 3600s. Refresh a minute early to avoid racing expiry.
let tokenCache = { value: null, expiresAt: 0 };

async function getAccessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) return tokenCache.value;

  const creds = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status}): ${body}`);

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Daraja auth returned non-JSON: ${body.slice(0, 200)}`);
  }
  if (!data.access_token) throw new Error(`Daraja auth returned no token: ${body}`);

  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000,
  };
  return tokenCache.value;
}

// Daraja wants YYYYMMDDHHmmss in East Africa Time, not UTC.
function timestamp() {
  const eat = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return eat.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
}

function password(ts) {
  return Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${ts}`).toString('base64');
}

// Accepts 07XXXXXXXX, 7XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX -> 2547XXXXXXXX
function normalizePhone(input) {
  const digits = String(input || '').replace(/[\s\-+()]/g, '');
  let p = digits;
  if (p.startsWith('0')) p = `254${p.slice(1)}`;
  else if (/^[17]\d{8}$/.test(p)) p = `254${p}`;
  return /^254[17]\d{8}$/.test(p) ? p : null;
}

app.post('/api/stk/push', async (req, res) => {
  try {
    if (!PUBLIC_BASE_URL) {
      return res.status(500).json({
        ok: false,
        error: 'PUBLIC_BASE_URL is not set. Run `ngrok http 3000` and put the https URL in .env.',
      });
    }

    const phone = normalizePhone(req.body.phone);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Invalid phone number. Use 07XX XXX XXX.' });
    }

    // Daraja rejects non-integer amounts. Sandbox caps at 150,000.
    const amount = Math.floor(Number(req.body.amount));
    if (!Number.isFinite(amount) || amount < 1 || amount > 150000) {
      return res.status(400).json({ ok: false, error: 'Amount must be between 1 and 150000.' });
    }

    const ts = timestamp();
    const token = await getAccessToken();

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password(ts),
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: `${PUBLIC_BASE_URL.replace(/\/$/, '')}/api/stk/callback`,
      AccountReference: (req.body.reference || 'Kanini Bags').slice(0, 12),
      TransactionDesc: 'Bag Purchase',
    };

    const push = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await push.json();

    if (data.ResponseCode !== '0') {
      console.error('STK push rejected:', data);
      return res.status(400).json({
        ok: false,
        error: data.errorMessage || data.CustomerMessage || 'STK push rejected by Safaricom.',
        raw: data,
      });
    }

    payments.set(data.CheckoutRequestID, {
      status: 'PENDING',
      amount,
      phone,
      createdAt: Date.now(),
    });
    console.log(`STK push sent -> ${phone} KES ${amount} (${data.CheckoutRequestID})`);

    res.json({
      ok: true,
      checkoutRequestId: data.CheckoutRequestID,
      customerMessage: data.CustomerMessage,
    });
  } catch (err) {
    console.error('STK push error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Safaricom POSTs the final result here. Must be publicly reachable over HTTPS.
app.post('/api/stk/callback', (req, res) => {
  // Always ack first — Safaricom retries on a non-200 regardless of our parsing.
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const cb = req.body?.Body?.stkCallback;
  if (!cb) {
    console.warn('Callback with unexpected shape:', JSON.stringify(req.body));
    return;
  }

  const { CheckoutRequestID, ResultCode, ResultDesc } = cb;
  const items = Object.fromEntries(
    (cb.CallbackMetadata?.Item || []).map((i) => [i.Name, i.Value])
  );

  const record = {
    ...(payments.get(CheckoutRequestID) || {}),
    status: String(ResultCode) === '0' ? 'SUCCESS' : 'FAILED',
    resultCode: String(ResultCode),
    resultDesc: ResultDesc,
    receipt: items.MpesaReceiptNumber || null,
    amount: items.Amount ?? payments.get(CheckoutRequestID)?.amount,
    phone: items.PhoneNumber ? String(items.PhoneNumber) : payments.get(CheckoutRequestID)?.phone,
    completedAt: Date.now(),
  };

  payments.set(CheckoutRequestID, record);
  console.log(
    `Callback ${CheckoutRequestID}: ${record.status}` +
      (record.receipt ? ` receipt=${record.receipt}` : ` (${ResultDesc})`)
  );
});

app.get('/api/stk/status/:id', async (req, res) => {
  const id = req.params.id;
  const record = payments.get(id);
  if (!record) return res.status(404).json({ ok: false, error: 'Unknown CheckoutRequestID.' });
  if (record.status !== 'PENDING') return res.json({ ok: true, ...record });

  // Still pending. The callback may have been missed (dead tunnel, restart), so
  // ask Daraja directly. Safaricom only answers once the user acts, returning
  // 500.001.1001 "transaction is being processed" until then — that's not an error.
  try {
    const ts = timestamp();
    const token = await getAccessToken();
    const q = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password(ts),
        Timestamp: ts,
        CheckoutRequestID: id,
      }),
    });
    const data = await q.json();

    if (data.ResultCode !== undefined && data.errorCode !== '500.001.1001') {
      const updated = {
        ...record,
        status: String(data.ResultCode) === '0' ? 'SUCCESS' : 'FAILED',
        resultCode: String(data.ResultCode),
        resultDesc: data.ResultDesc,
      };
      payments.set(id, updated);
      return res.json({ ok: true, ...updated });
    }
  } catch (err) {
    console.warn('STK query fallback failed:', err.message);
  }

  res.json({ ok: true, ...record });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    env: MPESA_ENV,
    shortcode: MPESA_SHORTCODE,
    callbackUrl: PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL.replace(/\/$/, '')}/api/stk/callback` : null,
  });
});

app.listen(PORT, () => {
  console.log(`\n  Kanini Bags running -> http://localhost:${PORT}`);
  console.log(`  M-Pesa: ${MPESA_ENV} · shortcode ${MPESA_SHORTCODE}`);
  console.log(
    PUBLIC_BASE_URL
      ? `  Callback: ${PUBLIC_BASE_URL.replace(/\/$/, '')}/api/stk/callback\n`
      : `  WARNING: PUBLIC_BASE_URL not set — run \`ngrok http ${PORT}\` and add it to .env\n`
  );
});
