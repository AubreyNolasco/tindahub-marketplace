-- Phase 1 of the address/PSGC/shipping refactor: province and city are
-- already stored as PSGC codes (psgc_provinces/psgc_cities); barangay was
-- name-only everywhere. AddressFields.jsx now selects barangay_code from
-- SearchableSelect alongside the name -- these columns are where it lands.

alter table public.profiles add column if not exists barangay_code text references public.psgc_barangays(code);
alter table public.merchant_profiles add column if not exists barangay_code text references public.psgc_barangays(code);
alter table public.customers add column if not exists barangay_code text references public.psgc_barangays(code);

notify pgrst, 'reload schema';
