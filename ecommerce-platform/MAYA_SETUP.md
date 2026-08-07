# Maya Online Top-Up Setup

Adds an optional "Pay with Maya (instant)" button to the existing wallet top-up modal (`TopupModal.jsx`), alongside PayMongo/Stripe/PayPal if those are also enabled. **Off by default** and invisible to Merchants/Resellers until an admin enables it — the existing manual flow (choose GCash/Maya/Bank, enter a reference number, upload a screenshot, wait for admin review) is untouched and stays available regardless.

## How the fallback works

- `integration_configs['payments.maya'].enabled = false` (seeded default) → `TopupModal` never renders the Maya button. Nothing changes for any user.
- Admin enables it + saves real Maya keys in Settings → Integrations → Maya → the button appears.
- If Maya's API is briefly unreachable when a user clicks it, `maya-create-intent` fails *before* creating any `topup_requests` row, and the modal shows a toast telling the user to use the manual form below — which is still on screen, unaffected.
- A paid checkout flips the same `topup_requests.status` column an admin's Approve button uses, so the existing `handle_topup_approved()` trigger credits the wallet exactly like a manual approval — there is one wallet-crediting code path, not two.

## Weaker webhook trust than PayMongo/Stripe — read this before enabling

Maya does not publish an HMAC signing secret for its webhooks (unlike PayMongo/Stripe) — authenticity is only established by IP allowlisting per Maya's own docs. `maya-webhook` therefore never trusts the webhook body's `paymentStatus` alone: it re-fetches the authoritative status from Maya's `GET /checkout/v1/checkouts/{id}` endpoint (Basic auth, secret key) before crediting anything. The IP check in `adapters/maya.ts` is a hint, not proof.

## 1. Apply the database migration

No new migration is needed for Maya specifically — `'maya'` already exists in the `payment_method` enum (it's been the manual-Maya-top-up value since the original schema); the online path reuses it. `public.payment_intents` (generic across providers) already exists from `20260806000100_paymongo_topup_intents.sql`.

## 2. Get Maya API keys

1. Sign up / log in at the Maya Business Dashboard (developers.maya.ph).
2. Start in **Sandbox** — copy the Sandbox Public Key and Secret Key.
3. Once verified end-to-end, switch to **Production** and copy the live keys instead.

## 3. Configure the webhook

1. In the Maya Dashboard → Webhooks (per developers.maya.ph/reference/configuring-your-webhook-for-maya-checkout).
2. URL: `https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/maya-webhook`
3. Subscribe to Checkout success/failure/dropout events (confirm exact event names in your dashboard — the ones this handler checks for are VERIFY-flagged in `maya-webhook/index.ts`).
4. Maya has no webhook signing secret to copy — the IP-allowlist + re-fetch posture above is what stands in for it.

## 4. Configure in Settings → Integrations

Open Admin → Settings → Integrations → Maya:
- **Enabled**: on (only once you're ready to expose the button)
- **Mode**: sandbox or production
- **Credentials**: `public_key` = the Public Key, `secret_key` = the Secret Key
- Save — credentials go straight to Supabase Vault (`save_integration_config`), never a plaintext column, matching every other integration.

## 5. Deploy

```bash
supabase db push
supabase functions deploy maya-create-intent
supabase functions deploy maya-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is required — without it, Supabase's platform-level gateway rejects every call with 401 before your code ever runs, since Maya's webhook calls carry no Supabase session JWT (same reason `paymongo-webhook`/`lalamove-webhook` are deployed the same way). `maya-create-intent` keeps default JWT verification since it's only ever called by a signed-in user via the frontend SDK.

Deploying is safe at any time — both functions no-op (`NOT_CONFIGURED` / disabled-skip) until the integration is enabled with real credentials in step 4.

## 6. Test flow

1. In Sandbox mode, open the wallet top-up modal as a Reseller/Merchant — confirm **Pay with Maya (instant)** appears.
2. Enter an amount, click it, complete a Maya sandbox test payment.
3. Confirm Maya redirects back to `/wallet?maya=success`.
4. Confirm the webhook fired: Settings → Integrations → Maya → Logs shows an inbound event with `confirmed_status: "PAYMENT_SUCCESS"`.
5. Confirm the wallet balance increased and a `topup_requests` row exists with `method = 'maya'`, `status = 'approved'`, `admin_notes = 'Auto-approved via Maya'`.
6. Disable the integration again and confirm the button disappears and the manual form still works exactly as before.

## Files

```text
supabase/
├── migrations/20260806000100_paymongo_topup_intents.sql   (payment_intents table, reused — no Maya-specific migration)
└── functions/
    ├── _shared/payments/adapters/maya.ts   (Checkout API + best-effort IP webhook check)
    ├── maya-create-intent/index.ts         (creates checkout, TopupModal calls this)
    └── maya-webhook/index.ts               (Maya calls this; re-fetches status before trusting it)

src/
├── lib/services/maya.js                (isMayaEnabled, createMayaCheckout)
└── components/wallet/TopupModal.jsx    (Pay with Maya button, additive)
```
