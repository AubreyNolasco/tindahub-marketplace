# Google Maps Address Autocomplete

Splits every address fill-up form in the system (reseller address, merchant pickup address, saved customers, checkout shipping address) into real fields — House/Unit No. & Street, Barangay, City, Province, Postal Code — instead of one free-text textarea. On top of that, once enabled, a "Search your address on Google Maps…" box lets a user pick their place from Google and have every field (plus GPS coordinates, where the table has room for them) filled in automatically.

**The structured fields always work, with or without this integration.** Maps only adds the search-and-autofill shortcut; enabling/disabling it never removes the manual fields, and typing a location by hand always works exactly like the search box, minus the one-click autofill.

## Why this isn't like the other integrations

PayMongo, Google Vision, and Semaphore all use a **server-side secret key**, so they follow the Vault-backed `integration_configs` pattern: the key never leaves Supabase, only an edge function sees it.

The Google Maps *JavaScript* API is different — the key has to run in the browser to load the map script, so it can never be a secret. Google's own security model for it is **HTTP referrer restriction** in Cloud Console (the key only works when called from your domain), not secrecy. So:
- The **on/off switch** still goes through the same `integration_configs`/`is_integration_enabled('maps.google')` mechanism as everything else — admins flip it on in Settings → Integrations exactly like any other row.
- The **API key itself** is a public Vite build-time variable (`VITE_GOOGLE_MAPS_API_KEY`), set in Vercel next to `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, not stored in Vault. There is no "Credentials" field to fill in for this row in the Integrations UI — nothing there would be private.

## 1. Apply the database migration

`supabase/migrations/20260806000400_structured_addresses.sql` — additive only:
- Adds `street`, `barangay`, `city`, `province`, `postal_code` to `profiles`, `merchant_profiles`, `customers`.
- Adds `latitude`/`longitude` to `profiles` (new — nothing consumes it yet, added for parity/future use).
- Reuses the coordinate columns that already existed: `merchant_profiles.pickup_latitude/pickup_longitude`, `customers.latitude/longitude` — both were already required by the delivery/Lalamove pipeline (`delivery-quote`, `delivery-book`, `lalamove-quote`, `lalamove-book`) but **nothing in the app was ever writing to them** before this change. The Customers "Add Customer" form and both address pages now fill them in whenever Maps is used (or left blank for manual/legacy entries, same as before).
- The original single-text columns (`profiles.address`, `merchant_profiles.business_address`, `customers.address`, `orders.shipping_address`, referral `customer_address`) are untouched — the frontend composes them from the structured parts on save, so every existing reader (delivery adapters, admin tables, order history, `isCompleteAddress()`) keeps working unchanged.

## 2. Get a Google Maps API key

1. Google Cloud Console → APIs & Services → enable the **Maps JavaScript API** and **Places API** on your project.
2. Credentials → Create Credentials → API key.
3. **Restrict the key** (important, since it's public): Application restrictions → HTTP referrers → add your production domain (e.g. `https://tindahub-marketplace.vercel.app/*`) and your Vercel preview domain pattern. API restrictions → limit to Maps JavaScript API + Places API only.

## 3. Set the env var in Vercel

```bash
vercel env add VITE_GOOGLE_MAPS_API_KEY production
vercel env add VITE_GOOGLE_MAPS_API_KEY preview
```

Then redeploy — Vite bakes `VITE_*` vars in at build time, so a new deployment is required for the key to take effect (same as any other `VITE_*` var here).

## 4. Enable in Settings → Integrations

Open Admin → Settings → Integrations → Google Maps (address autocomplete):
- **Enabled**: on
- No credentials/webhook secret to fill in — see "Why this isn't like the other integrations" above.

The search box only appears once **both** this is enabled **and** the deployed build has a real `VITE_GOOGLE_MAPS_API_KEY` — either one missing, and every address form silently falls back to plain manual fields.

## 5. Test flow

1. Open Reseller/Merchant → Address (or Onboarding, or Reseller → Customers → Add Customer, or Checkout's shipping address).
2. Confirm the "Search your address on Google Maps…" box appears above the 5 fields.
3. Type a real PH address, pick a result — confirm House/Unit No. & Street, Barangay, City, Province, and Postal Code all populate, and (on the Address pages and Add Customer) the "Location pinned from Google Maps" note appears.
4. Manually edit any field afterward — confirm the pin note disappears (the coordinates are cleared rather than silently kept against a changed address).
5. Save, then check the row directly: `customers.latitude`/`longitude` or `merchant_profiles.pickup_latitude`/`pickup_longitude` should be populated for the first time — previously always `null` from the UI.
6. Disable the integration and confirm every form still works with the 5 plain fields, no search box, no error.

## Files

```text
supabase/migrations/20260806000400_structured_addresses.sql

src/
├── utils/address.js                       (composeAddress, partsFromLegacyAddress — legacy-compatible)
├── lib/googleMaps.js                      (lazy script loader, VITE_GOOGLE_MAPS_API_KEY)
├── lib/services/maps.js                   (isMapsEnabled)
├── components/address/AddressFields.jsx   (the shared split-field + autocomplete component)
└── pages/
    ├── ProfileAddress.jsx                 (reseller address / merchant pickup address)
    ├── Auth/Onboarding.jsx                (signup-time address)
    ├── Reseller/Customers.jsx             (saved customer address — writes latitude/longitude)
    └── Reseller/Checkout.jsx              (shipping address, composed into orders.shipping_address)
```

`src/pages/Reseller/ClinicDiscovery.jsx`'s small optional "City / Province" referral field was deliberately left as a single input — it's not tied to delivery/coordinates and sits in a tight 2-column layout with the phone field.

## Adding structured/Maps address to another form

1. `import AddressFields from '.../components/address/AddressFields'` and `composeAddress`/`emptyAddressParts`/`partsFromLegacyAddress` from `utils/address.js`.
2. Keep the parts in state, render `<AddressFields value={parts} onChange={setParts} required withCoordinates />` (drop `withCoordinates` if the target table has no lat/lng columns).
3. On save, write `composeAddress(parts)` to whatever legacy text column already exists (for backward compatibility) plus the structured columns if the table has them.
