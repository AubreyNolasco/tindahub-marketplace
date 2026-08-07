# Stripe Online Top-Up Setup

Adds an optional "Pay with Stripe (instant)" button to the existing wallet top-up modal (`TopupModal.jsx`), for international cards — alongside PayMongo/Maya/PayPal if those are also enabled. **Off by default** and invisible to Merchants/Resellers until an admin enables it — the existing manual flow (choose GCash/Maya/Bank, enter a reference number, upload a screenshot, wait for admin review) is untouched and stays available regardless.

## How the fallback works

- `integration_configs['payments.stripe'].enabled = false` (seeded default) → `TopupModal` never renders the Stripe button. Nothing changes for any user.
- Admin enables it + saves real Stripe keys in Settings → Integrations → Stripe → the button appears.
- If Stripe's API is briefly unreachable when a user clicks it, `stripe-create-intent` fails *before* creating any `topup_requests` row, and the modal shows a toast telling the user to use the manual form below — which is still on screen, unaffected.
- A paid checkout session flips the same `topup_requests.status` column an admin's Approve button uses, so the existing `handle_topup_approved()` trigger credits the wallet exactly like a manual approval — there is one wallet-crediting code path, not two.

## 1. Apply the database migration

`supabase/migrations/20260808000100_stripe_paypal_payment_method.sql` — additive only:
- Adds `'stripe'` and `'paypal'` to the existing `payment_method` enum (so top-ups via either show up in the admin queue/reports like any other method). `public.payment_intents` already exists from `20260806000100_paymongo_topup_intents.sql` and is generic across providers.

No existing table, column, trigger, or RLS policy is touched.

## 2. Get Stripe API keys

1. Sign up / log in at the Stripe Dashboard.
2. Start in **Test mode** — copy the Test Secret Key.
3. Once verified end-to-end, switch to **Live mode** and copy the Live Secret Key instead.

## 3. Configure the webhook

1. In the Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. URL: `https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/stripe-webhook`
3. Subscribe to: `checkout.session.completed`, `checkout.session.async_payment_failed`, `checkout.session.expired` (exact event coverage is VERIFY-flagged in `stripe-webhook/index.ts` — confirm against your account's API version).
4. Copy the generated webhook signing secret (`whsec_...`).

## 4. Configure in Settings → Integrations

Open Admin → Settings → Integrations → Stripe:
- **Enabled**: on (only once you're ready to expose the button)
- **Credentials**: `secret_key` = the Secret Key
- **Webhook secret**: the value from step 3 (`webhook_secret`)
- Save — credentials go straight to Supabase Vault (`save_integration_config`), never a plaintext column, matching every other integration.

## 5. Deploy

```bash
supabase db push
supabase functions deploy stripe-create-intent
supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is required — without it, Supabase's platform-level gateway rejects every call with 401 before your code ever runs, since Stripe's webhook calls carry no Supabase session JWT (same reason `paymongo-webhook`/`lalamove-webhook` are deployed the same way). `stripe-create-intent` keeps default JWT verification since it's only ever called by a signed-in user via the frontend SDK.

Deploying is safe at any time — both functions no-op (`NOT_CONFIGURED` / disabled-skip) until the integration is enabled with real credentials in step 4.

## 6. Test flow

1. In Test mode, open the wallet top-up modal as a Reseller/Merchant — confirm **Pay with Stripe (instant)** appears.
2. Enter an amount, click it, complete checkout with a Stripe test card (e.g. `4242 4242 4242 4242`).
3. Confirm Stripe redirects back to `/wallet?stripe=success`.
4. Confirm the webhook fired: Settings → Integrations → Stripe → Logs shows an inbound `checkout.session.completed` event.
5. Confirm the wallet balance increased and a `topup_requests` row exists with `method = 'stripe'`, `status = 'approved'`, `admin_notes = 'Auto-approved via Stripe'`.
6. Disable the integration again and confirm the button disappears and the manual form still works exactly as before.

## Note on refunds

`stripeAdapter.refund()` takes a PaymentIntent id (`pi_...`), not the Checkout Session id stored in `payment_intents.external_ref` — pull it from `payment_intents.raw_payload` (the webhook's `session.payment_intent` field) if a refund flow is ever wired up. Not yet used by any UI action.

## Files

```text
supabase/
├── migrations/20260808000100_stripe_paypal_payment_method.sql
└── functions/
    ├── _shared/payments/adapters/stripe.ts   (Checkout Sessions API + HMAC-SHA256 webhook signature check)
    ├── stripe-create-intent/index.ts         (creates checkout session, TopupModal calls this)
    └── stripe-webhook/index.ts               (Stripe calls this on session status change)

src/
├── lib/services/stripe.js              (isStripeEnabled, createStripeCheckout)
└── components/wallet/TopupModal.jsx    (Pay with Stripe button, additive)
```
