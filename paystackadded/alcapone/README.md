# Al Capone Club — Paystack Checkout Integration

This project is a simple Node/Express server + static frontend (`index.html`) that supports **Paystack hosted Checkout** for collecting payments.

The checkout experience is now **one unified Paystack flow**: when a customer checks out, they are redirected/opened into **Paystack Checkout**, and they choose the payment method there (M-Pesa, Card, Airtel Money, etc.).

## What was implemented / changed

### 1) Hosted Paystack Checkout (primary payment path)
- The app uses **server-side transaction initialization** (Paystack `/transaction/initialize`).
- The frontend opens the returned `authorization_url` in a popup window (or falls back to same-tab redirect).

### 2) Payment confirmation reliability
Paystack can sometimes not return cleanly to the main page (popup blocked, user closes tab, etc.). To make the flow resilient:
- A **callback page** (`/paystack/callback`) posts the Paystack `reference` back to the opener window using `postMessage`.
- A **polling fallback** runs on the main page, repeatedly checking payment status for the reference until it becomes `success`.

### 3) Order finalization only after verification
Orders are only marked paid and shown as “successful” after:
- `/api/verify-payment` confirms the Paystack transaction is `success`, and
- the order is saved to Supabase.

### 4) Frontend always loads the latest checkout logic
To avoid stale browser caching:
- `server.js` sets `Cache-Control: no-store` for `.html` files.

### 5) Checkout UX updates
- Checkout UI now has **one Paystack button** (no “M-Pesa vs Card” tabs on the site).
- Required fields are gathered before sending the customer to Paystack:
  - `table-number`
  - `phone`
  - `name`
  - `email`

### 6) Supabase insert resilience
Some Supabase schemas may not match the exact fields sent by the frontend (example: missing `payment_reference`).

To prevent the checkout from failing after successful payment:
- `createOrder()` retries inserts and automatically removes any fields Supabase reports as “missing column …”
- It also keeps a fallback for user foreign key issues by retrying with `user_id: null`.

## Key files

- `server.js`
  - Serves `index.html`
  - Exposes Paystack-related endpoints
  - Disables caching for HTML

- `index.html`
  - Checkout UI
  - Calls the backend to initialize Paystack
  - Opens Paystack Checkout
  - Polls verification + finalizes order in Supabase

## Backend API

### `GET /api/config`
Returns the Paystack public key.

### `POST /api/paystack/initialize`
Initializes a Paystack transaction server-side and returns the Paystack response containing:
- `authorization_url`
- `reference`

Payload example:
```json
{
  "email": "customer@example.com",
  "amount": 2000,
  "currency": "KES",
  "reference": "AC-...",
  "metadata": {"custom_fields": []}
}
```

### `GET /paystack/callback`
Paystack redirect target.

This page:
- Sends `{ type: 'paystack:callback', reference }` to `window.opener` via `postMessage` when possible
- Falls back to redirecting the browser to `/?paystack_reference=...`

### `POST /api/verify-payment`
Verifies a transaction using Paystack `/transaction/verify/:reference`.

Notes:
- Returns success when Paystack returns `data.status === 'success'`.
- Returns a non-error JSON response for “not confirmed yet” so the polling loop can keep running without noisy HTTP 400s.

## Frontend payment flow (high level)

1. User clicks checkout and submits details.
2. Frontend calls `POST /api/paystack/initialize`.
3. Frontend opens Paystack `authorization_url`.
4. Frontend saves a pending order in `localStorage` (`alCaponePendingPaystack`).
5. Frontend polls `POST /api/verify-payment` until Paystack reports `success`.
6. Frontend calls `createOrder()` to save the order to Supabase.
7. Frontend shows the success modal.

## Running locally

### Requirements
- Node.js `>= 14`

### Install
```bash
npm install
```

### Configure environment
Create a `.env` in the project root:
```bash
PORT=3001
PAYSTACK_SECRET_KEY=sk_...
PAYSTACK_PUBLIC_KEY=pk_...
# Optional:
# PAYSTACK_CALLBACK_URL=https://your-domain.com/paystack/callback
```

### Start
```bash
npm start
```
Then open:
- http://localhost:3001

### Dev mode
```bash
npm run dev
```

## Troubleshooting

### “Payment completed on Paystack but no success modal”
Most common causes:
- Supabase insert is failing (check DevTools Console for `Supabase insert error`)
- Paystack callback didn’t return (polling should still finalize within a few seconds)

### Callback issues on live domains
If Paystack does not redirect properly on live keys/domains, set:
- `PAYSTACK_CALLBACK_URL=https://<your-public-https-domain>/paystack/callback`

### If you still see lots of verify requests
This is expected during payment pending state (polling). It should stop once payment becomes `success`.

## Security notes (important)

- Do **NOT** commit real Paystack live keys to Git.
- `.env` should remain ignored.
- If live keys were ever committed/pushed, you should **rotate/revoke them immediately** in your Paystack dashboard.
- Prefer committing a safe template like `.env.example` that contains placeholders only (no real secrets).
