# Lalamove Delivery Integration Setup

Lets a Merchant, a Reseller, or the Platform (Admin, as a shared fallback) connect their own Lalamove account so orders get a **real-time delivery quote** and an **automatic booking** the moment a shipping fee is accepted — instead of the manual "enter courier + tracking number yourself" flow. It is **per-account opt-in**: nobody's orders are affected until that specific Merchant, Reseller, or Admin connects and enables their own Lalamove account. If nobody along the order's chain has Lalamove connected, the existing manual shipping flow is used exactly as before.

This doc exists because, unlike the other integrations (PayMongo, Google Vision, Semaphore SMS), Lalamove **predates** the shared `integration_configs`/Vault pattern and has its own dedicated table (`delivery_provider_accounts`) that supports three independent owners instead of one global on/off switch. Read this before entering a real API key — there are two setup steps outside the app UI that are easy to miss and fail silently if skipped.

## How it works

- Three tiers can each connect their own Lalamove account, from their own settings page: **Merchant** (`/merchant/delivery`), **Reseller** (`/reseller/delivery`), and **Platform/Admin** (`/admin/delivery-providers`, used as a shared fallback when neither party in an order has their own).
- When a Merchant requests a delivery quote during order processing, `delivery-quote` tries each connected account for that order in priority order — **Merchant's own first, then the Reseller's, then the Platform's** — and returns the first one that produces a live quote.
- The moment the Reseller accepts that quote as the shipping fee, a database trigger (`trg_notify_lalamove_dispatch_ready`) fires `delivery-book`, which books the actual Lalamove order using **whichever account produced the winning quote** — not always the Reseller's, if the Merchant's or Platform's account won instead.
- Lalamove's delivery-status webhook updates `lalamove_bookings.status` for tracking display only — it never changes `orders.status`. Order completion still always runs on the existing 7-day buyer-confirmation flow, whether or not Lalamove's webhook ever arrives.

## 1. Get a Lalamove API key

1. Sign up / log in at the [Lalamove Developer Console](https://www.lalamove.com/api).
2. Start with a **Sandbox** key pair (API Key + API Secret) — sandbox and production use *different* credentials, they are not interchangeable.
3. Once you've verified a real quote and booking against sandbox, request production access and generate a **Production** key pair.

## 2. Enter credentials in the app

Whoever is connecting (Merchant, Reseller, or Admin) opens their own **Delivery Settings** page, toggles **Enable Lalamove** on, and enters the API Key + API Secret + Market (Metro Manila / Cebu). Saving calls `save_delivery_provider_account`, which stores the key/secret in Supabase Vault — the raw values are never round-tripped back to the browser after saving, only a "Connected" flag.

This step alone is enough for **quotes and bookings to start working** for that account — but two more steps below are required for the *automatic* booking-on-fee-acceptance step to actually fire, and for real (non-sandbox) credentials to hit Lalamove's real servers.

## 3. Set `LALAMOVE_ENV` (required before using production keys)

The shared Lalamove client defaults to **sandbox** (`https://rest.sandbox.lalamove.com`) unless told otherwise:

```bash
supabase secrets set LALAMOVE_ENV=production
```

**If you skip this and enter real production API keys, quotes will fail** — production credentials won't authenticate against the sandbox endpoint. Leave this unset while testing with sandbox keys; set it only when you're ready to go live with real deliveries.

## 4. Set the dispatch secret (once, required for auto-booking)

Same shared-secret pattern used by SMS notifications (`SMS_DISPATCH_SECRET`/`sms_dispatch_secret`) — a random value stored in two places so only the database trigger (not the public internet) can invoke `delivery-book`:

```bash
# generate any random string, e.g.:
openssl rand -hex 32

# store it as the edge function's env var
supabase secrets set LALAMOVE_DISPATCH_SECRET=<the random value>
```

Then store the **same** value in Vault as `lalamove_dispatch_secret` (Dashboard → Database → Vault → New secret, name `lalamove_dispatch_secret`).

**This is the step most likely to be missed, and it fails completely silently.** If the two values don't match — or if the Vault secret was never created at all — the trigger's `net.http_post` to `delivery-book` either never fires or gets rejected, and **the order just stays stuck in "processing" after the Reseller accepts the fee, with no error shown anywhere.** Always do a real end-to-end test (Step 7) after setup, not just a credentials-saved check.

## 5. Deploy

```bash
supabase db push
supabase functions deploy delivery-quote
supabase functions deploy delivery-book --no-verify-jwt
supabase functions deploy lalamove-webhook --no-verify-jwt
```

`delivery-quote` is called directly by a logged-in Merchant's browser, so it keeps normal JWT verification. `delivery-book` is invoked by the database trigger via `pg_net` (no Supabase session JWT present) and `lalamove-webhook` is a public endpoint Lalamove itself calls — both need `--no-verify-jwt`; their own secret/signature checks (Steps 4 and the webhook signature) are what actually authorizes them.

## 6. Important: this client has not been live-tested against a real Lalamove account

`supabase/functions/_shared/lalamove.ts` and `lalamove-webhook/index.ts` were written directly against Lalamove's documented REST v3 contract, but **no real sandbox account was available while writing them** — several specifics are marked `VERIFY` in the code and should be confirmed against your own sandbox account before relying on this in production:

- Exact field names for `stops`, `sender`, and `recipients` on the quotation/order request ([`_shared/lalamove.ts`](supabase/functions/_shared/lalamove.ts)).
- Whether the `Market` header needs just the country code (`PH`) or a city-scoped value (`PH_MNL`).
- The webhook signature header name — currently assumed to be `x-lalamove-signature` ([`lalamove-webhook/index.ts`](supabase/functions/lalamove-webhook/index.ts)).
- The exact shape of the webhook payload (where the order ID and status actually live in the JSON body).
- The exact status enum values Lalamove sends (`ASSIGNING_DRIVER`, `ON_GOING`, etc.) — `mapLalamoveStatus()` guesses at these.

**Test with a real sandbox account before enabling this for real resellers** (Step 7) — if any of the above turn out to differ from what's coded, the fix is a small, isolated change in exactly the file noted above; it won't affect anything else in the app.

## 7. Test flow

1. Connect a **sandbox** Lalamove account from a test Reseller's Delivery Settings and confirm it shows "Connected."
2. As that Reseller (or their Merchant), place and progress a test order to "Processing" with pickup/dropoff coordinates set.
3. From the Merchant side, request a shipping fee — confirm a real Lalamove sandbox quote comes back (not a fallback estimate).
4. As the Reseller, accept the fee.
5. **Confirm the order actually moves to "Shipped" with a real tracking number within a few seconds** — this is the step that silently fails if Step 4 (dispatch secret) was skipped or mismatched.
6. Check `lalamove_bookings` for a `booked` (or later) status row, and `lalamove_webhook_events` for any inbound status callbacks once Lalamove's sandbox starts sending them.
7. Only after this passes end-to-end on sandbox, switch to production keys and repeat with a small real order.

## Two related cleanup items (not blocking, flagged for awareness)

- `lalamove-quote` and `lalamove-book` (the original single-tier functions, predating the three-tier `delivery-quote`/`delivery-book` engine) are no longer called by the app anywhere — the frontend and the dispatch trigger both use the generalized functions. They still read credentials from the old `lalamove_settings` table via `get_lalamove_credentials`, which nothing writes to anymore, so calling them directly would always report "not connected." Safe to leave deployed as-is (unreachable from the UI) or retire them — your call, not required for the setup above to work.
- `lalamove-webhook`'s credential lookup was fixed to resolve via the same `delivery_provider_accounts` path as `delivery-quote`/`delivery-book`, instead of the old reseller-only `get_lalamove_credentials` (which would have silently skipped signature verification on every booking made through the current system).

## Files

```text
supabase/
├── migrations/
│   ├── 20260729001100_lalamove_booking_pipeline.sql   (legacy reseller-only tables/RPCs, frozen)
│   ├── 20260801000200_delivery_providers_catalog.sql  (delivery_providers catalog)
│   ├── 20260801000300_delivery_provider_accounts.sql  (current 3-tier accounts + credentials RPCs)
│   └── 20260801000500_delivery_dispatch_engine.sql    (generalized dispatch trigger)
└── functions/
    ├── _shared/delivery/
    │   ├── types.ts                   (DeliveryProviderAdapter contract)
    │   ├── registry.ts                (getAdapter('lalamove'))
    │   └── adapters/lalamove.ts       (wraps the raw REST client below)
    ├── _shared/lalamove.ts            (HMAC-signed REST v3 client — see Step 6)
    ├── delivery-quote/index.ts        (current — tries Merchant → Reseller → Platform)
    ├── delivery-book/index.ts         (current — auto-fired by the dispatch trigger)
    └── lalamove-webhook/index.ts      (public callback endpoint from Lalamove)
```
