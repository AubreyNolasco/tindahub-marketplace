# Cloudinary (Product Images) + Google Drive (Payment Proofs) — Progress & Handoff

Tracker for this request: product images should upload to **Cloudinary**; payment-proof screenshots (wallet top-up proof, withdrawal transfer proof) should upload to the **user's own personal Google Drive** — private, no one else has access to it.

**Non-negotiable constraint (user's own words, autonomous-mode instructions)**: install dependencies, write code, run migrations, run tests, and commit autonomously without stopping — but pause and ask when a manual login, a real secret/API key, or browser-based OAuth consent is strictly required. Both integrations below hit that wall at least once:
- **Cloudinary** needs a real Cloud Name + API Key + API Secret from the user's own Cloudinary account — cannot be fabricated.
- **Google Drive** needs a real Google Cloud OAuth Client ID (tied to a Google account, can't be created by the agent) **and** the user completing a one-time browser consent screen so the app can get a refresh token scoped to *their* Drive specifically — this is what makes it "only I can see it" rather than a shared/service-account Drive.

## 🔧 Batches — in order

- [ ] **Batch 0 — Investigate current architecture.** Confirm today's product-image upload path (Merchant/ProductForm.jsx → Supabase Storage, which bucket, which helpers in `utils/security.js`), today's payment-proof upload path (Wallet top-up / withdrawal-proof forms), and whether the existing `_shared/<category>/adapters/` + `integration_configs` + Admin → Integrations pattern (used for PayMongo/Vision/SMS/Groq per `TASK1.md`) already has a "storage/media" category to extend, or whether one needs to be added.
- [ ] **Batch 1 — Cloudinary adapter for product images.** New `_shared/storage/adapters/cloudinary.ts` (or equivalent, matching whatever the existing adapter contract shape is), swap `ProductForm.jsx`'s image upload from direct Supabase Storage to Cloudinary (unsigned upload preset or signed upload via edge function — decide based on what keeps the API secret server-side only). Needs: Cloud Name, API Key, API Secret from the user.
- [ ] **Batch 2 — Google Drive adapter for payment proofs.** Google Cloud OAuth Client ID/Secret (user-provided), one-time browser consent flow to obtain a refresh token for the user's own Drive account, refresh token stored in Supabase Vault (same pattern as other provider secrets), server-side (edge function) upload so the token is never exposed client-side, scoped with the minimal `drive.file` scope (app-created files only — not full Drive access). Swap the wallet top-up proof upload and the withdrawal transfer-proof upload to this path.
- [ ] **Batch 3 — Migrations, tests, build, live verification.** Any new `integration_configs` rows/categories via migration, `npm run build && npx eslint . && npm test`, then a live Chrome check of both upload flows (submit a top-up with a proof image, confirm it lands in the connected Google Drive; add a product image, confirm it serves from Cloudinary).

## Blocked on (from the user)

1. Cloudinary account — Cloud Name, API Key, API Secret.
2. A Google Cloud project + OAuth Client ID/Secret for Drive access, and the user completing the one-time browser OAuth consent so the app gets a refresh token for their own Drive.

## Notes for whoever picks this up next

- Follow the existing `_shared/<category>/adapters/<code>.ts` + `registry.ts` + `is_integration_enabled()`/`get_integration_credentials()` + Admin → Integrations page pattern already proven for PayMongo/Vision/SMS/Groq (see `TASK1.md`) instead of inventing a new integration mechanism.
- Google Drive scope should be `drive.file` (least-privilege — only files the app itself creates), not broad `drive` access, since this is explicitly meant to be private and minimal.
- Never let the Cloudinary API Secret or the Google refresh token reach the client bundle — both must be read server-side (edge function / Vault) only, consistent with how this codebase already handles Lalamove/PayMongo secrets.
