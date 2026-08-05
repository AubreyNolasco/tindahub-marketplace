# Address Fields: PSGC Dropdowns + LocationIQ Autocomplete

Splits every address fill-up form in the system (reseller address, merchant pickup address, saved customers, checkout shipping address) into real fields instead of one free-text textarea:

- **Province / City / Municipality / Barangay** — searchable dropdowns backed by the official PSGC (Philippine Standard Geographic Code) reference data, cascading: the City list only shows cities in the selected Province, the Barangay list only shows barangays in the selected City. There is no free-text option for these three — a barangay can never be paired with a city it doesn't actually belong to. Always on, no integration/API key needed (`20260806000600_psgc_reference_data.sql`, imported once from the official list — never a live third-party call).
- **House/Unit No. & Street, Postal Code** — plain text (PSGC doesn't cover street level).
- **LocationIQ search box** (optional, needs setup below) — speeds up filling in Street + GPS coordinates by typing a full address and picking a suggestion. It deliberately never touches Province/City/Barangay — a geocoder's free-text guess for those could disagree with the official PSGC name and desync the dropdowns from what's actually stored.

**The dropdowns and manual fields always work, with or without LocationIQ.** LocationIQ only adds the street/coordinates shortcut; enabling/disabling it never removes anything else, and typing the street by hand always works, minus the one-click autofill.

## Why LocationIQ instead of Google Maps

Google's Maps Platform needs a billing account with a credit card on file (a generous $200/month free credit, but still a card). LocationIQ's Autocomplete API is genuinely free — **5,000 requests/day, no credit card** — built on OpenStreetMap data. Trade-off: OSM's Philippine address coverage is community-mapped, so it's reliably good in Metro Manila/Cebu/Davao and can be spottier or incomplete in smaller municipalities. The manual fields are there specifically so a missed suggestion is never a dead end — just type it in.

## Why this isn't like the other integrations

PayMongo, Google Vision, and Semaphore all use a **server-side secret key**, so they follow the Vault-backed `integration_configs` pattern: the key never leaves Supabase, only an edge function sees it.

LocationIQ's key is called directly from the browser (`fetch()` on every keystroke, debounced), so it can never be a real secret — same situation as a Google Maps JS key. LocationIQ's own security model is **HTTP referrer restriction** in their dashboard, not secrecy. So:
- The **on/off switch** still goes through the same `integration_configs`/`is_integration_enabled('maps.locationiq')` mechanism as everything else — admins flip it on in Settings → Integrations exactly like any other row.
- The **API key itself** is a public Vite build-time variable (`VITE_LOCATIONIQ_API_KEY`), set in Vercel next to `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, not stored in Vault. There is no "Credentials" field to fill in for this row in the Integrations UI — nothing there would be private.

## 1. Apply the database migrations

- `supabase/migrations/20260806000400_structured_addresses.sql` — adds `street`, `barangay`, `city`, `province`, `postal_code` to `profiles`, `merchant_profiles`, `customers`, plus `latitude`/`longitude` to `profiles`. Reuses the coordinate columns that already existed: `merchant_profiles.pickup_latitude/pickup_longitude`, `customers.latitude/longitude` — both were already required by the delivery/Lalamove pipeline but **nothing in the app was ever writing to them** before this change.
- `supabase/migrations/20260806000500_switch_maps_to_locationiq.sql` — replaces the `maps.google` row seeded by the migration above (never enabled, no credentials — dead the moment this project pivoted to LocationIQ) with `maps.locationiq`.
- `supabase/migrations/20260806000600_psgc_reference_data.sql` — the full official PSGC list: `psgc_provinces` (82 rows, including a synthetic "Metro Manila" for NCR, which has no province in the real PSGC hierarchy), `psgc_cities` (1,634 rows), `psgc_barangays` (42,046 rows), imported once from [psgc.gitlab.io/api](https://psgc.gitlab.io/api/) so the dropdowns never depend on a third party being reachable. Read-only reference tables, `authenticated`-only RLS.

The original single-text columns (`profiles.address`, `merchant_profiles.business_address`, `customers.address`, `orders.shipping_address`) are untouched — the frontend composes them from the structured parts on save, so every existing reader (delivery adapters, admin tables, order history, `isCompleteAddress()`) keeps working unchanged.

## 2. Get a LocationIQ API key

1. Sign up free at [locationiq.com](https://locationiq.com) — no credit card required for the free tier.
2. Dashboard → Access Tokens → copy your token.
3. **Restrict the token** (Account → Security): add your production domain and Vercel preview domain pattern so the public key can't be reused elsewhere.

## 3. Set the env var in Vercel

```bash
vercel env add VITE_LOCATIONIQ_API_KEY production
vercel env add VITE_LOCATIONIQ_API_KEY preview
```

Then redeploy — Vite bakes `VITE_*` vars in at build time, so a new deployment is required for the key to take effect.

## 4. Enable in Settings → Integrations

Open Admin → Settings → Integrations → LocationIQ (address autocomplete):
- **Enabled**: on
- No credentials/webhook secret to fill in — see "Why this isn't like the other integrations" above.

The search box only appears once **both** this is enabled **and** the deployed build has a real `VITE_LOCATIONIQ_API_KEY` — either one missing, and every address form silently falls back to plain manual fields.

## 5. Test flow

**PSGC dropdowns (always on, test this regardless of LocationIQ):**
1. Open Reseller/Merchant → Address (or Onboarding, or Reseller → Customers → Add Customer, or Checkout's shipping address).
2. Click Province — confirm a searchable list of all provinces (plus Metro Manila) appears; type to filter.
3. Pick a province — confirm City becomes enabled and only shows cities/municipalities in that province.
4. Pick a city — confirm Barangay becomes enabled and only shows barangays in that city.
5. Reopen an address that was already saved — confirm Province/City/Barangay show the existing selection (not blank), via `resolvePsgcCodes()` matching the saved names back to PSGC codes.

**LocationIQ search box (needs setup above):**
6. Type at least 3 characters of a real PH address in the search box — confirm a dropdown of suggestions appears within about a second.
7. Click a suggestion — confirm House/Unit No. & Street and (on the Address pages and Add Customer) the "Location pinned from search" note appear. Province/City/Barangay are **not** touched by this — they stay whatever was already picked in the dropdowns above.
8. Manually edit the street afterward — confirm the pin note disappears (coordinates are cleared rather than silently kept against a changed address).
9. Save, then check the row directly: `customers.latitude`/`longitude` or `merchant_profiles.pickup_latitude`/`pickup_longitude` should be populated for the first time — previously always `null` from the UI.
10. Disable the integration and confirm every form still works — dropdowns and manual fields unaffected, just no search box.

## Files

```text
supabase/migrations/
├── 20260806000400_structured_addresses.sql
├── 20260806000500_switch_maps_to_locationiq.sql
└── 20260806000600_psgc_reference_data.sql

src/
├── utils/address.js                       (composeAddress, partsFromLegacyAddress — legacy-compatible)
├── lib/locationiq.js                      (searchAddress fetch wrapper, VITE_LOCATIONIQ_API_KEY)
├── lib/services/maps.js                   (isMapsEnabled)
├── lib/services/psgc.js                   (listProvinces/listCities/listBarangays, resolvePsgcCodes)
├── components/address/
│   ├── AddressFields.jsx                  (the shared field layout — dropdowns + street/postal + search box)
│   └── SearchableSelect.jsx               (generic searchable dropdown used for Province/City/Barangay)
└── pages/
    ├── ProfileAddress.jsx                 (reseller address / merchant pickup address)
    ├── Auth/Onboarding.jsx                (signup-time address)
    ├── Reseller/Customers.jsx             (saved customer address — writes latitude/longitude)
    └── Reseller/Checkout.jsx              (shipping address, composed into orders.shipping_address)
```

`src/pages/Reseller/ClinicDiscovery.jsx`'s small optional "City / Province" referral field was deliberately left as a single input — it's not tied to delivery/coordinates and sits in a tight 2-column layout with the phone field.

## Adding structured/search address to another form

1. `import AddressFields from '.../components/address/AddressFields'` and `composeAddress`/`emptyAddressParts`/`partsFromLegacyAddress` from `utils/address.js`.
2. Keep the parts in state, render `<AddressFields value={parts} onChange={setParts} required withCoordinates />` (drop `withCoordinates` if the target table has no lat/lng columns).
3. On save, write `composeAddress(parts)` to whatever legacy text column already exists (for backward compatibility) plus the structured columns if the table has them.

## Switching back to Google Maps, or adding it as a second option later

`AddressFields.jsx` only knows about `searchAddress()` from `lib/locationiq.js` — swapping providers (or offering both) means writing an equivalent `lib/googleMaps.js` (or any other geocoder) with the same `{street, barangay, city, province, postalCode, latitude, longitude}` shape and switching what the component imports. Nothing else in the system (the DB columns, the 5 manual fields, the forms) needs to change.
