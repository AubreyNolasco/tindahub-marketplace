-- Phase 3 of the address/PSGC/shipping refactor: LocationIQ and Nominatim
-- geocoding were removed from AddressFields.jsx per the client's decision
-- to run the whole address/map stack on PSGC + Leaflet only, with no
-- external geocoding/routing provider. The maps.locationiq on/off switch
-- (20260806000500_switch_maps_to_locationiq.sql) has nothing left to
-- gate, so it's removed rather than left as an inert admin toggle.
delete from public.integration_configs where key = 'maps.locationiq';

notify pgrst, 'reload schema';
