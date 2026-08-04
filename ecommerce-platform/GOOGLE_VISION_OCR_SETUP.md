# Google Vision OCR for Business Permit Review

Adds a **"Read with AI"** button next to the existing **"View permit"** button in Admin → Merchants. It is **off by default** and invisible until an admin enables it — the existing manual review flow (open the image, read it, type the expiry date, click Permit valid / Reject permit) is completely untouched.

## What it actually does — and doesn't do

- Extracts the raw text from a merchant's uploaded business permit image via Google Vision, and picks out any date-like strings it's confident about (month-name dates and `yyyy-mm-dd`/`yyyy/mm/dd` — deliberately skips ambiguous `dd/mm/yyyy` numeric dates rather than guess wrong).
- Shows that raw text + any candidate dates inline in the admin's merchant row, labeled "AI-read text... verify against the actual image."
- If the admin then clicks **Permit valid**, the expiry-date modal pre-fills with the first candidate date **only if no expiry is already on file** — it's still a normal editable date input, and the admin still has to click "Approve permit" themselves.
- **Never** sets `business_permit_status` itself. There is no automatic approval path — a human always makes the actual decision, same as today.
- On-demand only: it does not run automatically when a merchant uploads a permit, only when an admin clicks the button while reviewing. No API calls happen for permits nobody is currently looking at.
- If Google Vision is disabled, unconfigured, or the call fails, the button either doesn't render or shows a toast — the "View permit" / "Permit valid" / "Reject permit" buttons keep working exactly as before.

## 1. Apply the database migration

`supabase/migrations/20260806000200_business_permit_ocr.sql` — additive only:
- New table `public.document_ocr_results` (admin-read RLS, service-role write) storing the raw text + candidate dates per review. Generic on `subject_type`/`subject_id` so a future "Read with AI" on payment-proof screenshots can reuse it.

No existing table, column, trigger, or RLS policy is touched.

## 2. Get a Google Vision API key

1. Google Cloud Console → APIs & Services → enable the **Cloud Vision API** on your project.
2. Credentials → Create Credentials → API key.
3. Optionally restrict the key to the Vision API only, and to your Supabase project's outbound IP range if you want to lock it down further.

No OAuth setup needed — this integration calls Vision's REST endpoint with a plain API key.

## 3. Configure in Settings → Integrations

Open Admin → Settings → Integrations → Google Vision (permit OCR):
- **Enabled**: on (only once you're ready to expose the button)
- **Credentials**: add a field named `api_key` = the key from step 2
- No webhook secret needed (Vision is request/response only, no callbacks)
- Save — the key goes to Supabase Vault via `save_integration_config`, never a plaintext column.

## 4. Deploy

```bash
supabase db push
supabase functions deploy ocr-business-permit
```

No `--no-verify-jwt` needed here (unlike `paymongo-webhook`) — this function is only ever called by a signed-in admin/staff user via the frontend SDK, which attaches their session JWT automatically.

Deploying is safe at any time — the function no-ops (`NOT_CONFIGURED`) until the integration is enabled with a real key in step 3. Verified live: unauthenticated calls are correctly rejected by Supabase's platform gateway before reaching the function.

## 5. Test flow

1. In Admin → Merchants, with a pending merchant that has a permit attached, confirm **Read with AI** appears next to View permit.
2. Click it — confirm the extracted text (and any candidate dates) appear inline within a few seconds.
3. Click **Permit valid** — confirm the expiry date field is pre-filled with the AI's best guess (if the permit had a readable expiry date) and is still editable.
4. Confirm approving/rejecting still works exactly as before, including for merchants where OCR was never run.
5. Disable the integration and confirm the button disappears and review works exactly as before.

## Files

```text
supabase/
├── migrations/20260806000200_business_permit_ocr.sql
└── functions/
    ├── _shared/ocr/
    │   ├── types.ts                     (OcrProviderAdapter contract)
    │   ├── registry.ts                  (getAdapter('ocr.google_vision'))
    │   └── adapters/google_vision.ts    (Vision images:annotate + date-candidate extraction)
    └── ocr-business-permit/index.ts     (admin-invoked, "Read with AI" button calls this)

src/
├── lib/services/ocr.js                 (isOcrEnabled, readBusinessPermit)
└── pages/Admin/Merchants.jsx           (Read with AI button + result panel, additive)
```

## Adding OCR to another document (e.g. payment-proof screenshots)

`document_ocr_results.subject_type` already supports more than one kind of document. Add a new edge function following `ocr-business-permit/index.ts`'s shape (swap the storage bucket/table it reads from and the `subject_type` it writes), reusing the same `_shared/ocr/registry.ts` adapter — no changes needed to the adapter itself.
