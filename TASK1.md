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

## ⬜ Not started — remaining from the original request

### Payments
- [ ] Maya — `_shared/payments/adapters/maya.ts`, same `PaymentProviderAdapter` contract PayMongo already proved out.
- [ ] GCash (direct, if separate from PayMongo's GCash-via-checkout) — clarify with user whether PayMongo's GCash payment method already covers this before building a separate adapter.
- [ ] Stripe — international cards, same contract.
- [ ] PayPal — same contract.

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
- [ ] Semaphore — in progress, see above.
- [ ] Twilio — international SMS; lower priority than Semaphore for a PH-based marketplace.

### Storage (Supabase Storage already live for business-permits/payment-proofs buckets)
- [ ] AWS S3 — only worth it if Supabase Storage hits a real limit. Don't build speculatively.
- [ ] Cloudinary — same caveat, plus it's more of an image-transform service than a storage replacement; clarify actual need first.

### Maps
- [ ] Google Maps — check first whether merchant pickup / customer address lat-lng picking already uses this (likely yes, given `pickup_latitude`/`pickup_longitude` columns already exist) before treating it as "not started."

### AI
- [ ] OpenAI — `ai.openai` row already seeded, `_shared/ai/types.ts` contract already exists (built for this specifically, JomBits enhancement). Needs `adapters/openai.ts` + wiring into `JomBits.jsx`. Note already on file (from the integration-scaffolding session): update the "does not send your data to a third party" text in `JomBits.jsx` if/when this goes live — that claim becomes false.

### Analytics
- [ ] Google Analytics — low-risk, standard tracking snippet gated by the same integration-enabled pattern (only load the script client-side if enabled, so it never fires without consent/configuration).

## Notes on sequencing

Built in order of: (1) protects an existing manual process with real money/compliance stakes → payments, OCR; (2) reaches users outside the app → SMS, push; (3) everything else. Each remaining item still needs a real API key from the user before it can be tested — building ahead of that just produces unverified code, so the recommended approach is one adapter at a time, prioritizing whichever one the user actually has a key for next.
