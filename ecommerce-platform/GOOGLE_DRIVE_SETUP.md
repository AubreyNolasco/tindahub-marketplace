# Google Drive Payment-Proof Archive — Setup

Replaces where payment-proof screenshots end up: wallet top-up proof (`TopupModal.jsx`) and withdrawal transfer proof (`Admin/WithdrawalRequests.jsx`). **Off by default** — until enabled, both keep uploading to their existing private Supabase Storage buckets (`payment-proofs`, `withdrawal-proofs`) exactly as they do today.

## Important: this is one shared private archive, not a per-user Drive

This connects **one Google Drive account — yours** — and every payment-proof upload across the whole platform (every Reseller's top-up screenshot, every withdrawal transfer proof) lands in that one account. That's what makes "only I can see it" true: it's not shared with other admins, staff, Resellers, or Merchants — Google Drive's `drive.file` scope means the app can only ever see files it created itself, nothing else in your Drive, and nobody else can open those files unless you explicitly share them yourself from Drive.

This requires a **one-time setup you have to do yourself** — a browser consent screen only the Google account owner (you) can complete. Nothing here can be done by an AI/CLI on your behalf.

## How the fallback works

- `storage.google_drive.enabled = false` (seeded default) → proof uploads go to Supabase Storage, unchanged.
- Admin enables it + saves real credentials in Settings → Integrations → Google Drive → new proof uploads go to Drive instead.
- If Drive is briefly unreachable, or the token has expired/been revoked, the upload fails silently and falls back to the existing Supabase Storage bucket in the same submit — the user never sees an error.
- Viewing proof in Admin → Top-Up Requests now shows **"Open in Drive"** instead of an inline image when a request's proof was stored in Drive (a private file can't be embedded as an `<img>` the way a Supabase signed URL can) — clicking it opens the file in Drive, where you're already signed in as yourself.

## 1. Create a Google Cloud OAuth Client (one-time)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a new project (or reuse an existing one).
2. **APIs & Services → Library** → search "Google Drive API" → Enable.
3. **APIs & Services → OAuth consent screen** → User Type: **External** → fill in the required app name/support email → Publishing status can stay **Testing** (no Google verification needed — "Testing" apps work fine for personal use like this, they just show an "unverified app" warning during consent, which is expected and safe to click through since it's your own app and your own data).
4. Under **Test users**, add your own Google account email — required while the app is in Testing mode, otherwise the consent screen will reject you.
5. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: **Web application** → under **Authorized redirect URIs**, add exactly:
   ```
   https://developers.google.com/oauthplayground
   ```
   (This points at Google's own OAuth Playground tool — see step 2 — so no redirect page needs to be built or hosted for this one-time setup.)
6. Copy the **Client ID** and **Client Secret** shown after creating it.

## 2. Get a refresh token via Google's OAuth Playground (one-time, in your browser)

1. Open [Google OAuth Playground](https://developers.google.com/oauthplayground).
2. Click the gear icon (top right) → check **"Use your own OAuth credentials"** → paste the Client ID and Client Secret from step 1.
3. In the left panel, find **Drive API v3** → select the scope:
   ```
   https://www.googleapis.com/auth/drive.file
   ```
   (Only this scope — not full Drive access. This is what limits the app to only ever seeing files it created.)
4. Click **Authorize APIs** → sign in with the Google account whose Drive you want proofs stored in → you'll see an "unverified app" warning (expected, since Publishing status is Testing) → click **Advanced → Go to (your app name), unsafe** → **Allow**.
5. Back on the Playground, click **Exchange authorization code for tokens**.
6. Copy the **Refresh token** shown — this is the long-lived credential the app will use going forward. (The Access token shown alongside it is short-lived and not needed — the app derives a fresh one from the refresh token automatically on every upload.)

## 3. (Optional) Create a folder in your Drive to keep proofs organized

1. In Google Drive, create a folder (e.g. "JOM HUB Payment Proofs").
2. Open it, copy the folder ID from the URL: `https://drive.google.com/drive/folders/`**`THIS_PART`**.
3. If skipped, uploads land in your Drive's root folder instead — functionally identical, just less tidy.

## 4. Configure in Settings → Integrations

Open Admin → Settings → Integrations → Google Drive:
- **Enabled**: on (only once you're ready to switch proof uploads over)
- **Mode**: production
- **Credentials**: add these fields —
  - `client_id` = the Client ID from step 1
  - `client_secret` = the Client Secret from step 1
  - `refresh_token` = the Refresh token from step 2
  - `folder_id` = the folder ID from step 3 (optional — omit to use Drive's root)
- Save — credentials go straight to Supabase Vault (`save_integration_config`), never a plaintext column, matching every other integration in this app.

## 5. Deploy

```bash
supabase db push
supabase functions deploy google-drive-upload
```

Deploying is safe at any time — the function no-ops (`NOT_CONFIGURED`) until the integration is enabled with real credentials in step 4.

## 6. Test flow

1. Enable the integration with real credentials.
2. As a Reseller/Merchant, submit a wallet top-up with a proof screenshot.
3. In your own Google Drive, confirm a new file appeared (in the folder from step 3, or root).
4. In Admin → Top-Up Requests, confirm the button next to that request says **"Open in Drive"** and clicking it opens the file.
5. Disable the integration again and confirm top-up/withdrawal proof uploads still work exactly as before, landing back in their Supabase Storage buckets.

## A refresh token can stop working

Google refresh tokens for apps in **Testing** mode expire after 7 days of the OAuth consent screen being in that state, or immediately if you revoke access from your [Google Account's connected apps page](https://myaccount.google.com/permissions). If uploads silently start falling back to Supabase Storage, that's the most likely cause — repeat step 2 to mint a new refresh token, or move the OAuth consent screen to **Published** (still doesn't require Google's verification review for a `drive.file`-only scope app) for a token that doesn't expire on a timer.

## Files

```text
supabase/
├── migrations/20260806001100_storage_integrations.sql
└── functions/
    ├── _shared/storage/
    │   ├── types.ts                        (StorageProviderAdapter contract)
    │   ├── registry.ts                     (getAdapter('storage.google_drive'))
    │   └── adapters/google_drive.ts        (token refresh + Drive v3 multipart upload)
    └── google-drive-upload/index.ts        (proxies the file, TopupModal.jsx / WithdrawalRequests.jsx call this)

src/
├── lib/services/googleDriveUpload.js       (isGoogleDriveEnabled, uploadPaymentProofToGoogleDrive)
├── components/wallet/TopupModal.jsx        (top-up proof upload, additive fallback)
└── pages/Admin/
    ├── WithdrawalRequests.jsx              (transfer proof upload, additive fallback)
    └── TopupRequests.jsx                   ("Open in Drive" vs signed-URL proof viewing)
```
