# Integration Roadmap — Full Checklist

Master tracker for "lahat" (all) the integrations discussed. Every item follows the SAME rule, non-negotiable:

> If the API is not configured (disabled / no credentials in `integration_configs`), the system MUST keep using the current manual/existing workflow, unchanged. The automated path only ever activates once real credentials are added in Admin → Settings → Integrations, and falls back silently on any failure. No existing table, trigger, RPC, RLS policy, or UI flow is modified — only added to.

Pattern proven twice already (PayMongo, Google Vision) — every remaining item is a mechanical repeat of: one `_shared/<category>/adapters/<code>.ts` file implementing that category's existing contract, registered in that category's `registry.ts`, gated by `is_integration_enabled()`/`get_integration_credentials()`, one setup `.md` doc.

## ✅ Done

- [x] **Integration scaffolding** (`integration_configs`, `integration_event_logs`, `notifications`, `_shared/payments|sms|ai` folders, Admin → Integrations page) — `20260804000100_integration_scaffolding.sql`
- [x] **PayMongo** (payments) — online wallet top-up, additive to manual top-up form. `PAYMONGO_SETUP.md`. Needs real sandbox key to test.
- [x] **Google Vision** (OCR) — "Read with AI" on business permit review, advisory only. `GOOGLE_VISION_OCR_SETUP.md`. Needs real API key to test.

## ✅ Done (continued)

- [x] **Semaphore SMS** — SMS notifications on top-up approved / withdrawal approved-rejected, via a `net.http_post` Postgres trigger (same pattern as `notify_lalamove_dispatch_ready`), fires on BOTH manual admin approval and PayMongo auto-approval without touching either code path. `20260806000300_semaphore_sms_notifications.sql`, `adapters/semaphore.ts`, `send-sms` edge function, `SEMAPHORE_SMS_SETUP.md`. Needs a real Semaphore API key + Vault `sms_dispatch_secret` to test end-to-end.
- [x] **Structured address fields: PSGC dropdowns + LocationIQ autocomplete** — every address fill-up in the system (reseller/merchant address, saved customers, checkout shipping) split from one free-text textarea into: Province/City/Barangay as cascading searchable dropdowns backed by the official PSGC list (`20260806000600_psgc_reference_data.sql` — 82 provinces incl. a synthetic "Metro Manila" for NCR, 1,634 cities, 42,046 barangays, imported once from psgc.gitlab.io so it never depends on a live third party), plus free-text Street/Postal Code, plus an optional LocationIQ search box that only auto-fills Street + GPS coordinates (deliberately never Province/City/Barangay, to avoid a geocoder guess disagreeing with the official PSGC name). Confirmed while building this: `merchant_profiles.pickup_latitude/pickup_longitude` and `customers.latitude/longitude` already existed and were already required by the delivery/Lalamove quote pipeline, but nothing in the UI ever wrote to them — this closes that gap. Started as Google Maps, switched to LocationIQ per user request for a genuinely free (no credit card) option, then province/city/barangay were further switched from free text to PSGC dropdowns per user request for accuracy (barangay list is always valid for whichever city is selected — impossible to mismatch). Public `VITE_LOCATIONIQ_API_KEY` (not a Vault secret — called directly from the browser) + `maps.locationiq` on/off row for the search box only; the PSGC dropdowns need no API key and are always on. `20260806000400_structured_addresses.sql`, `20260806000500_switch_maps_to_locationiq.sql`, `20260806000600_psgc_reference_data.sql`, `AddressFields.jsx`, `SearchableSelect.jsx`, `LOCATIONIQ_SETUP.md`.
- [x] **Groq-backed JOM Bits, multilingual** — JomBits.jsx's client-side keyword matcher (`jomBitsKnowledge.js`) stays exactly as-is and is the fallback; a real LLM sits behind it for open-ended phrasing. The model is grounded server-side to a mirrored copy of JOM HUB's own process knowledge (`_shared/ai/knowledge.ts`, KEEP IN SYNC with `jomBitsKnowledge.js`) and explicitly instructed to say "I don't know" rather than guess/invent policy outside it — answers only from "the system," per the user's ask. Never sends account/wallet/order data, only the typed question + role + fixed knowledge text. Resolves the TODO already on file from the scaffolding session: the "does not send your data to a third party" banner in JomBits now reads correctly whether AI is on or off.
  - Provider went Gemini → Groq: user wanted "walang limitation" — corrected that no free tier is actually unlimited (every provider rate-limits somehow), but Groq's per-minute-shaped limit (~30 RPM, still ~1,000 req/day and ~100K tokens/day on the flagship model — not unlimited) fits bursty chat-widget traffic better in practice than Gemini's flat ~500/day wall. `ai.gemini` row swapped for `ai.groq` via `20260806000800_switch_jombits_ai_to_groq.sql` (same never-enabled-yet-so-just-replace-it precedent as the Maps→LocationIQ pivot). Defaults to `llama-3.1-8b-instant` (smaller models generally get more generous free daily quotas than flagship ones) — admin-configurable via a `model` credential field.
  - Multilingual, both paths: the Groq system prompt now explicitly detects the question's language (English/Tagalog/Bisaya/Taglish/anything) and replies in that same language — real language understanding needs the AI path, keyword matching can't do it. For the no-AI fallback, honestly can't achieve true "any language" (it's fixed keyword lookup, not understanding) — instead broadened every one of the ~30 keyword entries in `jomBitsKnowledge.js` with common Tagalog/Bisaya synonyms per topic, so accuracy in the realistic PH language mix improved substantially even with AI off; the fallback "I can only help with..." message also reads bilingually now.
  - Vault-secret pattern (server-side call, unlike Maps) — `ai.groq` row, alongside the still-seeded-but-unbuilt `ai.openai`. `20260806000700_gemini_jombits.sql` (superseded, kept for history), `20260806000800_switch_jombits_ai_to_groq.sql`, `adapters/groq.ts`, `jombits-ask` edge function, `GROQ_JOMBITS_SETUP.md`. Needs a real Groq API key to test the AI path; keyword-matcher answers (now broader) work today regardless.

## ✅ Done (continued, 2026-08-08)

- [x] **Maya** — `_shared/payments/adapters/maya.ts` (Checkout API). No HMAC webhook signature exists on Maya's side, so `maya-webhook` uses a best-effort IP-allowlist check plus a mandatory re-fetch of the authoritative status from Maya's own `GET /checkout/v1/checkouts/{id}` before crediting anything — the webhook body's `paymentStatus` is never trusted alone. `maya-create-intent`/`maya-webhook` edge functions, `MAYA_SETUP.md`. Reuses the existing `'maya'` `payment_method` enum value (already used by manual Maya top-ups) rather than adding a new one. Needs a real Maya sandbox key to test.
- [x] **Stripe** — `_shared/payments/adapters/stripe.ts` (Checkout Sessions API, form-encoded unlike every other adapter here), HMAC-SHA256 `Stripe-Signature` verification. `stripe-create-intent`/`stripe-webhook` edge functions, `STRIPE_SETUP.md`. New migration `20260808000100_stripe_paypal_payment_method.sql` adds `'stripe'` to `payment_method`. Needs a real Stripe test-mode key to test.
- [x] **PayPal** — `_shared/payments/adapters/paypal.ts` (Orders v2 API). Structurally different from every other adapter: OAuth2 client-credentials token on every call (no long-lived key), and a create-then-**approve-then-capture** flow instead of one hosted checkout — `paypal-webhook` performs the capture itself on `CHECKOUT.ORDER.APPROVED` since there's no other step in this flow that would. Webhook verification is a live call to PayPal's `/v1/notifications/verify-webhook-signature` (implemented in `paypal-webhook/index.ts` directly, not the adapter, since it needs a fresh OAuth token) — `paypalAdapter.verifyWebhook()` is a documented placeholder that always returns `false`, matching the shared contract shape without pretending PayPal's model fits it. `paypal-create-intent`/`paypal-webhook` edge functions, `PAYPAL_SETUP.md`, same enum migration as Stripe. Needs real PayPal sandbox credentials to test.
- Build/lint/tests all green after all three (`npx eslint .` 0 warnings, `npm run build` clean, `npm test` 36/36). `TopupModal.jsx` generalized from a single hardcoded PayMongo button to a small `ONLINE_PROVIDERS` array so each of the four payment gateways shows its own "Pay with X (instant)" button only when that specific integration is enabled — same additive/fallback contract as before, still falls through to the untouched manual form.
- **Not yet done**: no real credentials exist for any of the three, so none are exercised against a live sandbox account — every VERIFY flag from PayMongo's original caveat applies identically here. Not yet deployed (`supabase db push` / `supabase functions deploy`) or committed.

## ⬜ Not started — remaining from the original request

### Payments
- [ ] GCash (direct, if separate from PayMongo's GCash-via-checkout) — clarify with user whether PayMongo's GCash payment method already covers this before building a separate adapter.

### Shipping (delivery engine already live for Lalamove)
- [ ] GrabExpress — `_shared/delivery/adapters/grabexpress.ts`, same `DeliveryProviderAdapter` contract Lalamove already proved out.
- [ ] LBC — same contract.
- [ ] J&T — same contract.

### Authentication (Google already live)
- [ ] Facebook Login — Supabase Auth provider config + a second button on `Login.jsx`, same pattern as the existing Google button.
- [ ] Apple Login — same pattern. Needs an Apple Developer account (paid) — flag this to the user before starting.

### Notifications (in-app `notifications` table already live)
- [ ] Firebase Cloud Messaging — push notifications, seeded row `push.firebase` already exists in `integration_configs`. Needs a `_shared/push/` engine (doesn't exist yet, unlike payments/sms/ai/ocr).
- [ ] OneSignal — alternative to Firebase; confirm with user which one they actually want before building both.

### Email (SMTP already live per `config.toml`)
- [ ] SendGrid — only worth building if SMTP (current, working) has a real problem (deliverability, volume). Low priority — don't build without a stated reason.

### SMS
- [ ] Twilio — international SMS; lower priority than Semaphore for a PH-based marketplace.

### Storage (Supabase Storage already live for business-permits/payment-proofs buckets)
- [x] **Cloudinary** (product images only) — `ProductForm.jsx` uploads there instead of Supabase Storage once configured; falls back silently otherwise. `storage.cloudinary` in `integration_configs`, `_shared/storage/adapters/cloudinary.ts`, `CLOUDINARY_SETUP.md`. Needs real Cloudinary account keys to test.
- [x] **Google Drive** (payment-proof archive, not general storage) — wallet top-up proof and withdrawal transfer proof upload to one connected admin's own private Drive (`drive.file` scope — only files this app creates, nobody else has access) instead of the private Supabase Storage buckets, once configured; falls back silently otherwise. `storage.google_drive` in `integration_configs`, `_shared/storage/adapters/google_drive.ts`, `GOOGLE_DRIVE_SETUP.md`. Needs a one-time OAuth consent (via Google's own OAuth Playground, no custom connect-flow UI built) to get a refresh token.
- [ ] AWS S3 — only worth it if Supabase Storage hits a real limit. Don't build speculatively.

### AI
- [ ] OpenAI — `ai.openai` row already seeded, unused. Gemini (see Done above) covers the JomBits AI use case for free; only worth building if there's a specific reason to prefer OpenAI over Gemini for a given task. `_shared/ai/registry.ts` already supports both adapters side by side.

### Analytics
- [ ] Google Analytics — low-risk, standard tracking snippet gated by the same integration-enabled pattern (only load the script client-side if enabled, so it never fires without consent/configuration).

## Notes on sequencing

Built in order of: (1) protects an existing manual process with real money/compliance stakes → payments, OCR; (2) reaches users outside the app → SMS, push; (3) everything else. Each remaining item still needs a real API key from the user before it can be tested — building ahead of that just produces unverified code, so the recommended approach is one adapter at a time, prioritizing whichever one the user actually has a key for next.
