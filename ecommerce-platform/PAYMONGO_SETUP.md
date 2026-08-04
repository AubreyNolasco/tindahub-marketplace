# PayMongo Online Top-Up Setup

Adds an optional "Pay Online (instant)" button to the existing wallet top-up modal (`TopupModal.jsx`). It is **off by default** and invisible to Merchants/Resellers until an admin enables it — the existing manual flow (choose GCash/Maya/Bank, enter a reference number, upload a screenshot, wait for admin review) is untouched and stays the only option until then.

## How the fallback works

- `payment_intents.enabled = false` (seeded default) → `TopupModal` never renders the Pay Online button. Nothing changes for any user.
- Admin enables it + saves real PayMongo keys in Settings → Integrations → PayMongo → the button appears.
- If PayMongo's API is briefly unreachable when a user clicks it, `paymongo-create-intent` fails *before* creating any `topup_requests` row, and the modal shows a toast telling the user to use the manual form below — which is still on screen, unaffected.
- A paid checkout session flips the same `topup_requests.status` column an admin's Approve button uses, so the existing `handle_topup_approved()` trigger credits the wallet exactly like a manual approval — there is one wallet-crediting code path, not two.

## 1. Apply the database migration

`supabase/migrations/20260806000100_paymongo_topup_intents.sql` — additive only:
- Adds `'paymongo'` to the existing `payment_method` enum (so PayMongo top-ups show up in the admin queue/reports like any other method).
- New table `public.payment_intents` (maps a `topup_requests` row to a PayMongo checkout session).
- New RPC `is_integration_enabled(text)` — lets any signed-in user check if an integration is on, without exposing credentials (unlike `get_integration_configs()`, which is admin-only).

No existing table, column, trigger, or RLS policy is touched.

## 2. Get PayMongo API keys

1. Sign up / log in at the PayMongo Dashboard.
2. Start in **Test mode** — copy the Test Secret Key and Test Public Key.
3. Once verified end-to-end, switch to **Live mode** and copy the Live keys instead.

## 3. Configure the webhook

1. In PayMongo Dashboard → Developers → Webhooks → Create.
2. URL: `https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/paymongo-webhook`
3. Subscribe to: `checkout_session.payment.paid`, `checkout_session.payment.failed` (add `.expired` if PayMongo offers it — confirm exact event names in your dashboard, they're VERIFY-flagged in the code).
4. Copy the generated webhook signing secret.

## 4. Configure in Settings → Integrations

Open Admin → Settings → Integrations → PayMongo:
- **Enabled**: on (only once you're ready to expose the button)
- **Mode**: sandbox (test keys) or production (live keys)
- **Credentials**: `secret_key` = the Secret Key, `public_key` = the Public Key
- **Webhook secret**: the value from step 3
- Save — credentials go straight to Supabase Vault (`save_integration_config`), never a plaintext column, matching every other integration.

## 5. Deploy

```bash
supabase db push
supabase functions deploy paymongo-create-intent
supabase functions deploy paymongo-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is required — without it, Supabase's platform-level gateway rejects every call with 401 before your code ever runs, since PayMongo's webhook calls carry no Supabase session JWT (same reason `lalamove-webhook` is deployed the same way). `paymongo-create-intent` keeps default JWT verification since it's only ever called by a signed-in user via the frontend SDK.

Deploying is safe at any time — both functions no-op (`NOT_CONFIGURED` / disabled-skip) until the integration is enabled with real credentials in step 4. Verified live: `curl -X POST .../functions/v1/paymongo-webhook` returns `{"ok":true,"skipped":"INTEGRATION_DISABLED"}` right now, with PayMongo still disabled.

## 6. Test flow

1. In Test mode, open the wallet top-up modal as a Reseller/Merchant — confirm **Pay Online (instant)** appears.
2. Enter an amount, click it, complete a PayMongo test payment (test card/GCash per PayMongo's test docs).
3. Confirm PayMongo redirects back to `/wallet?paymongo=success`.
4. Confirm the webhook fired: Settings → Integrations → PayMongo → Logs shows an inbound `checkout_session.payment.paid` event.
5. Confirm the wallet balance increased and a `topup_requests` row exists with `method = 'paymongo'`, `status = 'approved'`, `admin_notes = 'Auto-approved via PayMongo'`.
6. Disable the integration again and confirm the button disappears and the manual form still works exactly as before.

## Files

```text
supabase/
├── migrations/20260806000100_paymongo_topup_intents.sql
└── functions/
    ├── _shared/payments/
    │   ├── types.ts                    (PaymentProviderAdapter contract)
    │   ├── registry.ts                 (getAdapter('payments.paymongo'))
    │   └── adapters/paymongo.ts        (Checkout Sessions API + webhook signature check)
    ├── paymongo-create-intent/index.ts (creates checkout session, TopupModal calls this)
    └── paymongo-webhook/index.ts       (PayMongo calls this on payment status change)

src/
├── lib/services/paymongo.js            (isPaymongoEnabled, createPaymongoCheckout)
└── components/wallet/TopupModal.jsx    (Pay Online button, additive)
```

## Adding the next gateway (Maya, GCash, Stripe, PayPal)

Same recipe as adding a new delivery courier (`_shared/delivery/adapters/`):
1. Write `_shared/payments/adapters/<code>.ts` implementing `PaymentProviderAdapter` from `types.ts`.
2. Register it in `_shared/payments/registry.ts`.
3. No changes needed to `paymongo-create-intent`/`paymongo-webhook` themselves if reusing the same edge functions generically — or copy them per-provider if the checkout flow differs enough (e.g. GCash direct API vs. a hosted checkout page). `payment_intents.provider_key` already supports multiple providers side by side.
