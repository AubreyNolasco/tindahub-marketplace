# PayPal Online Top-Up Setup

Adds an optional "Pay with PayPal (instant)" button to the existing wallet top-up modal (`TopupModal.jsx`), alongside PayMongo/Maya/Stripe if those are also enabled. **Off by default** and invisible to Merchants/Resellers until an admin enables it — the existing manual flow (choose GCash/Maya/Bank, enter a reference number, upload a screenshot, wait for admin review) is untouched and stays available regardless.

## How the fallback works

- `integration_configs['payments.paypal'].enabled = false` (seeded default) → `TopupModal` never renders the PayPal button. Nothing changes for any user.
- Admin enables it + saves real PayPal keys in Settings → Integrations → PayPal → the button appears.
- If PayPal's API is briefly unreachable when a user clicks it, `paypal-create-intent` fails *before* creating any `topup_requests` row, and the modal shows a toast telling the user to use the manual form below — which is still on screen, unaffected.
- A completed capture flips the same `topup_requests.status` column an admin's Approve button uses, so the existing `handle_topup_approved()` trigger credits the wallet exactly like a manual approval — there is one wallet-crediting code path, not two.

## Why PayPal needs two webhook events, not one

Every other gateway here uses a hosted checkout page that finishes the whole payment in one step. PayPal's Orders v2 API splits it: the buyer *approves* the order on PayPal's page (`CHECKOUT.ORDER.APPROVED`), but no money moves until the order is explicitly *captured* server-side. `paypal-webhook` captures the order itself on `CHECKOUT.ORDER.APPROVED` (there is no separate UI step for this), then also handles `PAYMENT.CAPTURE.COMPLETED`/`.DENIED` as the authoritative confirmation in case the synchronous capture call's own logging ever falls through.

PayPal also verifies webhooks differently from every other adapter here: instead of a local HMAC recompute, it's a live API call to PayPal's own `/v1/notifications/verify-webhook-signature` endpoint (implemented directly in `paypal-webhook/index.ts`, since it needs a fresh OAuth token the shared adapter contract doesn't carry).

## 1. Apply the database migration

`supabase/migrations/20260808000100_stripe_paypal_payment_method.sql` — additive only:
- Adds `'stripe'` and `'paypal'` to the existing `payment_method` enum (so top-ups via either show up in the admin queue/reports like any other method). `public.payment_intents` already exists from `20260806000100_paymongo_topup_intents.sql` and is generic across providers.

No existing table, column, trigger, or RLS policy is touched.

## 2. Get PayPal API credentials

1. Sign up / log in at the PayPal Developer Dashboard.
2. Create a Sandbox app under **Apps & Credentials** → copy the Sandbox Client ID and Secret.
3. Once verified end-to-end, create/switch to a Live app and copy those credentials instead.

## 3. Configure the webhook

1. In the same app's page → **Webhooks** → Add Webhook.
2. URL: `https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/paypal-webhook`
3. Subscribe to: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `CHECKOUT.ORDER.VOIDED` (exact event coverage is VERIFY-flagged in `paypal-webhook/index.ts`).
4. Copy the generated **Webhook ID** (not a signing secret — PayPal verifies via its own API, see above).

## 4. Configure in Settings → Integrations

Open Admin → Settings → Integrations → PayPal:
- **Enabled**: on (only once you're ready to expose the button)
- **Mode**: sandbox or production
- **Credentials**: `client_id`, `client_secret`, `webhook_id` = the Webhook ID from step 3
- Save — credentials go straight to Supabase Vault (`save_integration_config`), never a plaintext column, matching every other integration.

## 5. Deploy

```bash
supabase db push
supabase functions deploy paypal-create-intent
supabase functions deploy paypal-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is required — without it, Supabase's platform-level gateway rejects every call with 401 before your code ever runs, since PayPal's webhook calls carry no Supabase session JWT (same reason `paymongo-webhook`/`lalamove-webhook` are deployed the same way). `paypal-create-intent` keeps default JWT verification since it's only ever called by a signed-in user via the frontend SDK.

Deploying is safe at any time — both functions no-op (`NOT_CONFIGURED` / disabled-skip) until the integration is enabled with real credentials in step 4.

## 6. Test flow

1. In Sandbox mode, open the wallet top-up modal as a Reseller/Merchant — confirm **Pay with PayPal (instant)** appears.
2. Enter an amount, click it, approve the order with a PayPal sandbox buyer account.
3. Confirm PayPal redirects back to `/wallet?paypal=success`.
4. Confirm the webhook fired twice: Settings → Integrations → PayPal → Logs shows `CHECKOUT.ORDER.APPROVED` (with a `capture_order` outbound log showing `capture_status: "COMPLETED"`) followed by `PAYMENT.CAPTURE.COMPLETED`.
5. Confirm the wallet balance increased and a `topup_requests` row exists with `method = 'paypal'`, `status = 'approved'`, `admin_notes = 'Auto-approved via PayPal'`.
6. Disable the integration again and confirm the button disappears and the manual form still works exactly as before.

## Note on refunds

`paypalAdapter.refund()` takes a Capture id, not the Order id stored in `payment_intents.external_ref` — pull the capture id from `payment_intents.raw_payload` (set on the `PAYMENT.CAPTURE.COMPLETED` update) if a refund flow is ever wired up. Not yet used by any UI action.

## Files

```text
supabase/
├── migrations/20260808000100_stripe_paypal_payment_method.sql
└── functions/
    ├── _shared/payments/adapters/paypal.ts   (Orders v2 API; verifyWebhook is a placeholder — see paypal-webhook)
    ├── paypal-create-intent/index.ts         (creates an order, TopupModal calls this)
    └── paypal-webhook/index.ts               (live signature verification + capture + status handling)

src/
├── lib/services/paypal.js              (isPaypalEnabled, createPaypalCheckout)
└── components/wallet/TopupModal.jsx    (Pay with PayPal button, additive)
```
