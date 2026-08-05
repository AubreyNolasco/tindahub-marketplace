-- =====================================================================
-- Structured addresses — additive only.
--
-- Every address fill-up in the system (reseller profile, merchant pickup
-- address, saved customers) was a single free-text textarea. This splits
-- each into named parts (street, barangay, city, province, postal code)
-- so the UI can render real fields instead of one blob, and — where a
-- coordinate pair already exists (merchant_profiles.pickup_latitude/
-- pickup_longitude, customers.latitude/longitude) — an optional Google
-- Places Autocomplete search box can fill both the parts AND the
-- coordinates in one step.
--
-- The original single-text columns (profiles.address,
-- merchant_profiles.business_address, customers.address,
-- orders.shipping_address, referral customer_address, etc.) are NOT
-- removed or renamed. The frontend composes them from the structured
-- parts on save, so every existing reader of those columns (delivery
-- adapters, admin tables, order history, isCompleteAddress()) keeps
-- working unchanged. profiles gets its own new latitude/longitude pair
-- (nothing consumes it yet, added for parity/future use) — it does NOT
-- reuse merchant_profiles' or customers' columns, which stay scoped to
-- pickup/dropoff as the delivery pipeline already expects.
-- =====================================================================

alter table public.profiles
  add column if not exists street text,
  add column if not exists barangay text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);

alter table public.merchant_profiles
  add column if not exists street text,
  add column if not exists barangay text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists postal_code text;

alter table public.customers
  add column if not exists street text,
  add column if not exists barangay text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists postal_code text;

-- Settings -> Integrations gets a row for this like every other
-- provider, so admins can flip the Places Autocomplete search box on/off
-- without a code change. Unlike the server-side integrations (PayMongo,
-- Vision, Semaphore), the actual API key is a public Vite build-time env
-- var (VITE_GOOGLE_MAPS_API_KEY, set in Vercel) rather than a Vault
-- secret — Google's Maps JavaScript API key is always exposed
-- client-side by design (restricted by HTTP referrer in Google Cloud
-- Console, not by secrecy), so it has nothing to store in
-- credentials_ref. This row is purely the on/off switch the frontend
-- checks via is_integration_enabled('maps.google') before loading
-- Google's script; the structured address fields themselves always work
-- with or without it.
insert into public.integration_configs (key, label) values
  ('maps.google', 'Google Maps (address autocomplete)')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
