-- =====================================================================
-- Swap the address-autocomplete provider from Google Maps to LocationIQ.
--
-- 20260806000400_structured_addresses.sql seeded 'maps.google' minutes
-- before this migration, before ever being enabled or given credentials
-- — so this replaces that row outright rather than leaving a dead
-- integration_configs entry behind. Nothing else from that migration
-- (the structured address columns, the coordinate columns) changes.
--
-- Google's Maps JavaScript API needs a paid-billing-account API key
-- (a generous free credit, but a credit card on file); LocationIQ's
-- Autocomplete API has a genuinely free tier (5,000 requests/day, no
-- card) built on OpenStreetMap data, at the cost of address-detail
-- coverage that can be spottier outside major PH cities.
-- =====================================================================

delete from public.integration_configs where key = 'maps.google';

insert into public.integration_configs (key, label) values
  ('maps.locationiq', 'LocationIQ (address autocomplete)')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
