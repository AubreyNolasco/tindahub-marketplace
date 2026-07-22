-- merchant_profiles uses an explicit column-level SELECT allow-list to keep
-- pickup addresses and permit evidence private. Add only the public store-hour
-- fields introduced by the previous migration.
grant select (
  store_open_time,
  store_close_time,
  auto_pause_outside_hours,
  store_timezone
) on table public.merchant_profiles to anon, authenticated;

-- Owners need UPDATE privilege in addition to the existing owner RLS policy
-- to maintain their business details and optional store hours.
grant update (
  business_name,
  business_description,
  store_open_time,
  store_close_time,
  auto_pause_outside_hours,
  store_timezone
) on table public.merchant_profiles to authenticated;

notify pgrst, 'reload schema';
