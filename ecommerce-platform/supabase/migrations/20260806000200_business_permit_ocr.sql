-- =====================================================================
-- Google Vision OCR for business permit review — additive, advisory only.
--
-- Adds a "Read with AI" button next to the existing "View permit" button
-- in Admin/Merchants.jsx. It never approves/rejects anything: it only
-- extracts text + candidate expiry dates from the permit image so the
-- admin can pre-fill (and must still confirm/edit) the expiry date they
-- already type by hand today. The existing reviewPermit()/
-- confirmPermitApproval() flow in Merchants.jsx — including the required
-- human click on "Permit valid" / "Reject permit" — is completely
-- unchanged. Whenever ocr.google_vision is disabled or the call fails,
-- the "Read with AI" button simply doesn't appear / shows an error toast
-- and review proceeds exactly as it does today.
-- =====================================================================

create table if not exists public.document_ocr_results (
  id bigint generated always as identity primary key,
  subject_type text not null,
  subject_id uuid not null,
  provider_key text not null references public.integration_configs(key),
  raw_text text,
  candidate_dates text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists document_ocr_results_subject_idx on public.document_ocr_results(subject_type, subject_id, created_at desc);

alter table public.document_ocr_results enable row level security;

drop policy if exists "document_ocr_results_admin_read" on public.document_ocr_results;
create policy "document_ocr_results_admin_read" on public.document_ocr_results
  for select to authenticated using (public.is_admin());

-- Writes only from the ocr-business-permit edge function on the
-- service_role key, same convention as payment_intents/lalamove_bookings.
revoke insert, update, delete on public.document_ocr_results from authenticated, anon;
grant select on public.document_ocr_results to authenticated;
grant select, insert on public.document_ocr_results to service_role;

notify pgrst, 'reload schema';
