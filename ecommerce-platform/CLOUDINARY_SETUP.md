# Cloudinary Product Image Uploads — Setup

Replaces where product images end up when a Merchant (or Admin, posting on a Merchant's behalf) uploads one in `ProductForm.jsx`. **Off by default** — until enabled, product images keep uploading to the existing public `product-images` Supabase Storage bucket exactly as they do today.

## How the fallback works

- `storage.cloudinary.enabled = false` (seeded default) → `ProductForm.jsx` uploads to Supabase Storage, unchanged.
- Admin enables it + saves real Cloudinary credentials in Settings → Integrations → Cloudinary → new product images go to Cloudinary instead.
- If Cloudinary is briefly unreachable, or `cloudinary-sign-upload` fails for any reason, `ProductForm.jsx` catches it silently and falls back to the Supabase Storage upload in the same submit — the Merchant never sees an error, and the product still saves.
- The file itself never passes through our own server either way: the edge function only *signs* the upload, the browser POSTs the compressed image straight to Cloudinary's endpoint.

## 1. Get Cloudinary credentials

1. Sign up (or log in) at [cloudinary.com](https://cloudinary.com) — the free tier is enough for this.
2. Dashboard home page shows three values directly: **Cloud Name**, **API Key**, **API Secret**. Copy all three.

## 2. Configure in Settings → Integrations

Open Admin → Settings → Integrations → Cloudinary:
- **Enabled**: on (only once you're ready to switch product images over)
- **Mode**: production (Cloudinary doesn't have a separate sandbox account — sandbox/production here just tracks intent, both modes behave the same)
- **Credentials**: add three fields —
  - `cloud_name` = the Cloud Name
  - `api_key` = the API Key
  - `api_secret` = the API Secret
- Save — credentials go straight to Supabase Vault (`save_integration_config`), never a plaintext column, matching every other integration in this app.

## 3. Deploy

```bash
supabase db push
supabase functions deploy cloudinary-sign-upload
```

Deploying is safe at any time — the function no-ops (`NOT_CONFIGURED`) until the integration is enabled with real credentials in step 2.

## 4. Test flow

1. Enable the integration with real credentials.
2. As a Merchant, add or edit a product with a new image.
3. Confirm the saved product's image URL points at `res.cloudinary.com` (open browser dev tools → Network tab while saving, or just check the image URL after save).
4. Settings → Integrations → Cloudinary → Logs should NOT show anything for a successful upload (only signing failures are logged — successful signs aren't, to keep the log table from filling with routine noise; failures during rollout are what you're watching for).
5. Disable the integration again and confirm product image uploads still work exactly as before, landing back in the `product-images` Supabase Storage bucket.

## Files

```text
supabase/
├── migrations/20260806001100_storage_integrations.sql
└── functions/
    ├── _shared/storage/
    │   ├── types.ts                         (StorageProviderAdapter contract)
    │   ├── registry.ts                      (getAdapter('storage.cloudinary'))
    │   └── adapters/cloudinary.ts           (HMAC-SHA1 signed-upload params)
    └── cloudinary-sign-upload/index.ts      (signs the request, ProductForm.jsx calls this)

src/
├── lib/services/cloudinaryUpload.js         (isCloudinaryEnabled, uploadProductImageToCloudinary)
└── pages/Merchant/ProductForm.jsx           (image upload, additive fallback)
```
