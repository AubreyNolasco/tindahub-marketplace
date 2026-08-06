-- =====================================================================
-- Storage integrations — Cloudinary (product images) + Google Drive
-- (payment-proof archive), added to the existing integration_configs
-- framework (20260804000100_integration_scaffolding.sql) the same way
-- every other provider was: a seeded disabled row here, one
-- adapters/<code>.ts file, no schema/RPC changes to anything these
-- touch downstream (products.images[], topup_requests.proof_url,
-- withdrawal proof) — those columns are already free text and don't
-- care whether the value is a Supabase Storage path, a Cloudinary URL,
-- or a Google Drive link.
--
-- Both stay disabled until an admin fills in real credentials via the
-- existing Settings -> Integrations screen (zero new UI code needed —
-- that page already renders any integration_configs row generically).
-- Until enabled, ProductForm.jsx / TopupModal.jsx / WithdrawalRequests.jsx
-- keep uploading to Supabase Storage exactly as they do today.
-- =====================================================================

insert into public.integration_configs (key, label) values
  ('storage.cloudinary', 'Cloudinary (product images)'),
  ('storage.google_drive', 'Google Drive (payment-proof archive)')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
