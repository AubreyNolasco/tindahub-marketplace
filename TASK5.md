# Cloudinary (Product Images) + Google Drive (Payment Proofs) — Progress & Handoff

**Status: all code written, migrated, and deployed live. Blocked only on the user providing real credentials — see "Manual steps remaining" below.**

Product images now upload to **Cloudinary** (once configured); payment-proof screenshots (wallet top-up proof, withdrawal transfer proof) now upload to the **user's own private Google Drive** (`drive.file` scope — the app can only ever see files it itself creates, nobody else has access) instead of Supabase Storage — once configured. Built following the exact `_shared/<category>/adapters/` + `integration_configs` + Admin → Integrations pattern already proven in this codebase for PayMongo/Vision/SMS/Groq (see `TASK1.md`), so **zero new admin UI code was needed** — that page already renders any `integration_configs` row generically.

**Non-negotiable rule, same as every other integration in this app**: additive only. Until an admin enables each one with real credentials, `ProductForm.jsx` / `TopupModal.jsx` / `WithdrawalRequests.jsx` upload exactly where they always did (Supabase Storage buckets `product-images`, `payment-proofs`, `withdrawal-proofs`) — nothing existing was removed, and any failure at upload time falls back silently to that same existing path.

## What was built

- **Migration** `20260806001100_storage_integrations.sql` — seeds `storage.cloudinary` and `storage.google_drive` rows in `integration_configs`, both disabled by default. Deployed.
- **`_shared/storage/`** — `types.ts` (`StorageProviderAdapter` contract), `registry.ts`, `adapters/cloudinary.ts` (HMAC-SHA1 signed-upload params), `adapters/google_drive.ts` (OAuth refresh-token exchange + Drive v3 multipart upload).
- **Edge functions**, both deployed and live-smoke-tested (correctly reject unauthenticated calls, no crashes):
  - `cloudinary-sign-upload` — signs a request; the browser then POSTs the file straight to Cloudinary, never through our own server.
  - `google-drive-upload` — proxies the file (Drive uploads need an OAuth access token server-side only, unlike Cloudinary).
- **Frontend**: `src/lib/services/cloudinaryUpload.js`, `src/lib/services/googleDriveUpload.js` — same `isXEnabled()` + action-function shape as the existing `lib/services/paymongo.js`.
- **Rewired, all additive with silent fallback**: `ProductForm.jsx` (product image), `TopupModal.jsx` (top-up proof), `WithdrawalRequests.jsx` (transfer proof).
- **`Admin/TopupRequests.jsx`** proof viewer now detects a Drive-stored proof (`proof_url` starts with `http`) and shows "Open in Drive" instead of trying to sign it as a Supabase Storage path.
- **Setup docs**: `CLOUDINARY_SETUP.md`, `GOOGLE_DRIVE_SETUP.md` (full walkthrough including the one-time Google OAuth Playground consent flow — no custom connect-button UI was built; the existing generic credential-entry form in Settings → Integrations is enough once the user has the three Google values in hand).
- `TASK1.md`'s Storage section updated to reflect both as done.

## Manual steps remaining (nothing further can be automated — both need the account owner)

1. **Cloudinary**: sign up at cloudinary.com, copy Cloud Name / API Key / API Secret from the dashboard, paste into Admin → Settings → Integrations → Cloudinary, toggle Enabled. Full steps in `CLOUDINARY_SETUP.md`.
2. **Google Drive**: create a Google Cloud OAuth Client (Google Cloud Console, ~5 steps), then use Google's own OAuth Playground to complete a one-time browser consent and get a refresh token — full walkthrough in `GOOGLE_DRIVE_SETUP.md`. Paste `client_id` / `client_secret` / `refresh_token` (and optionally `folder_id`) into Admin → Settings → Integrations → Google Drive, toggle Enabled.

Both are pure data entry through the already-deployed Admin UI once the user has those values — no further code or deploy needed on either.

## Notes for whoever picks this up next

- No Docker locally in this environment, so the two edge functions couldn't be `supabase functions serve`'d locally before deploy — verified instead by a clean remote deploy (Supabase's bundler would reject a TypeScript syntax error) and a live unauthenticated smoke-test call to each (both correctly return `UNAUTHORIZED_NO_AUTH_HEADER` from the platform gateway, not a crash). Like every other adapter in this codebase, both carry a `VERIFY against a real account` comment — they were never exercised against a live Cloudinary/Google API call, since no real credentials exist yet.
- Google Drive scope is deliberately `drive.file`, not full `drive` access — the app can only ever see files it created itself. This is what actually makes "only I can see it" true, not just a naming choice.
- `topup_requests.proof_url` / withdrawal proof column stay free text either way — a Supabase Storage path (existing) or a full Drive `webViewLink` URL (new) both fit without a schema change. Detection elsewhere in the codebase, if ever needed again, should reuse the same `/^https?:\/\//` check already used in `TopupRequests.jsx`, not a new column.
