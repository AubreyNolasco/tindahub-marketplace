                 CUSTOMER
                     │
                     │
             Create Order
                     │   
                     ▼
            Customer Order Queue
                     │
                     ▼
                RESELLER
                     │
View Customer Order Details
- Ordered Items
- Customer Name
- Contact Number
- Delivery Address
- Shipping Fee Estimate
                     │
                     ▼
       Contact / Verify Customer
                     │
            Order Confirmed?
          ┌──────────┴──────────┐
          │                     │
         No                    Yes
          │                     │
  Cancel / Hold Order           ▼
                     Create Purchase Order
                     to Merchant
                     │
                     ▼
                 MERCHANT
                     │
            Receive Purchase Order
                     │
            Review Order Details
                     │
            Prepare / Pack Items
                     │
            Ready for Shipment
                     │
                     ▼
             Shipping Module
                     │
 Pickup Address → Route → Delivery Address
                     │
                     ▼
           Delivery / Courier
                     │
                     ▼
                 CUSTOMER
             Order Completed

Customer│▼Order Module│▼Reseller Module│▼Purchase Order Module│▼Merchant Module│▼Shipping Module│▼Delivery Module

Design the system using a modular architecture.

Each module must be independent and communicate through Services, Events, or APIs.

Customer Module

Customer registration

Customer profile

Customer addresses

Cart

Checkout

Order history

Order Module

Create customer order

Order validation

Order timeline

Order status

Payment information

Reseller Module

Receive customer orders

View customer details

Verify customer

Approve or reject orders

Generate Purchase Order

Purchase Order Module

Create Purchase Order

Send Purchase Order to Merchant

Purchase Order history

Purchase Order status

Merchant Module

Receive Purchase Orders

Inventory validation

Packing

Processing

Ready for Shipment

Shipping Module

Pickup Address

Delivery Address

Route Calculation

Distance Calculation

ETA

Shipping Fee

Shipment Status

Delivery Module

Courier Assignment

Pickup

In Transit

Delivered

Proof of Delivery

Delivery Timeline

The Shipping Module must be reusable.

The Address Module must be reusable.

The Shipping Module must never depend directly on Customer, Reseller, or Merchant.

Instead, it should only receive:

Pickup Address

Delivery Address

Vehicle Type

and return:

Distance

ETA

Shipping Fee

Route

This allows the Shipping Module to be reused by future modules without modification.



Free & Open Source Technologies

The system must use only free and open-source technologies.

Backend

Laravel 12 ✅

PHP 8.3+ ✅

MySQL / PostgreSQL ✅

Mapping

Philippine Standard Geographic Code (PSGC) ✅

OpenStreetMap (OSM) ✅

Leaflet.js ✅

Routing

Open Source Routing Machine (OSRM) ✅

Features

The system must support

✅ Route Visualization

Display pickup marker

Display drop-off marker

Draw route polyline

✅ Navigation Information

Road Distance

Estimated Travel Time (ETA)

Route Geometry

✅ Shipping Calculation

Compute road distance

Apply shipping formula

Return shipping fee

✅ Address Features

Manual PSGC Selection

Pick Location on Map

Current GPS Location

Reverse Geocoding

Automatic Address Filling

No Paid APIs

The implementation must NOT use

Google Maps API

Google Directions API

Google Distance Matrix API

Mapbox API

HERE Maps API

Bing Maps API

Any paid geocoding or routing service

Only free and open-source technologies are allowed.

---

## Recommendations & Suggestions (added 2026-08-08, before any build starts)

Checked this spec against what's actually live in this repo before recommending anything — most of the Customer → Reseller → Merchant → Shipping → Delivery chain described above **already exists**, just not under these module names. Three things worth deciding before writing any new code:

### 1. Backend stack — don't adopt Laravel/PHP literally

This spec's "Free & Open Source Technologies" section calls for Laravel 12 / PHP 8.3+ / MySQL-PostgreSQL. The live system is Supabase (Postgres + Deno edge functions) + React, already carrying real wallets, orders, and money movement — not a prototype to replace. Recommend treating TASK8 as a **target module architecture**, implemented as Postgres RPCs / Deno edge functions in the existing stack, not a literal Laravel rebuild. A parallel Laravel backend would mean two sources of truth for orders and payments, which is the one thing every other TASK*.md in this repo has gone out of its way to avoid (see TASK3.md's "never modify `quote_order`/`place_order`" rule).

### 2. Most of the workflow is already built — this is largely already done

- **Customer, Order, Reseller modules**: built end-to-end in `TASK3.md` (storefront ordering, product-detail popup, Reseller "Customer Orders" inbox with Accept/Decline/Convert, live-verified 2026-08-06). A customer already places a request with no account; a Reseller already reviews it with contact/address before converting.
- **Merchant receive → pack → ready-for-shipment**: already the existing `Orders.jsx` status flow (`processing` → ships via the delivery module below).
- **Shipping Module contract**: `_shared/delivery/types.ts` already defines exactly the reusable shape this spec asks for — `getQuote(pickup, dropoff)` / `createBooking(...)`, provider-agnostic, no dependency on Customer/Reseller/Merchant tables. `delivery-quote/index.ts` already tries multiple provider "tiers" (Merchant's own account → Reseller's → Platform's) and returns the first live quote — this is the reusable engine TASK8 describes, already working, just with one adapter registered (Lalamove) instead of an OSRM one.
- The one piece described here that genuinely doesn't exist yet: a **separate Purchase Order artifact** between Reseller-accepts and Merchant-fulfills (see #4 below).

### 3. The "no paid APIs" shipping requirement conflicts with what's live today — pick one

- The only registered delivery adapter is **Lalamove**, a paid commercial courier API — the opposite of this spec's "must use only free/open-source" constraint.
- The existing `calculateShipping()` (`src/utils/shipping.js`) / `calculate_standard_shipping()` (SQL) is already a **free, formula-based, distance-in/fee-out calculator** (weight/volume/vehicle-tier rules, no third-party call) — but nothing currently calls it. It's dead code today, not wired into any UI.
- There is no OSRM instance, no Leaflet map, and no route polyline anywhere in the app yet. `maps.locationiq` (LocationIQ) is used only for address autocomplete/reverse-geocoding, never for routing/distance — and it's a rate-limited third-party API too, not fully free/self-hosted.
- **Recommendation**: add a new `_shared/delivery/adapters/standard.ts` implementing the *same* `DeliveryProviderAdapter` contract Lalamove already proved out, backed by OSRM for road distance/duration/geometry and `calculate_standard_shipping()` for the fee — register it in `_shared/delivery/registry.ts` as a second tier alongside Lalamove, not a replacement. `delivery-quote`'s existing candidate loop already tries providers in order, so this is additive, zero risk to the Lalamove path.
- **Real gap to flag before building it**: OSRM's public demo server (`router.project-osrm.org`) explicitly prohibits production/commercial use in its own usage policy — a genuinely free, production-safe setup needs a **self-hosted OSRM instance** (Docker container + a Philippines OSM extract), and this project's current hosting (Vercel + Supabase, both fully managed, no arbitrary long-running container) has nowhere to run one persistently today. Worth resolving *before* committing to "no paid APIs" — either accept a small always-on host for OSRM (e.g. a $5-6/mo VPS — technically still "free and open-source software," just not free to *host*), or accept that a rate-limited public OSRM mirror is a sandbox-only stopgap, not a production answer.

### 4. Purchase Order Module — build as an audit artifact, not a second order system

Recommend a `purchase_orders` table created **automatically** the moment a Reseller's storefront request converts (1:1 with the resulting `orders` row it's already creating via the untouched `place_customer_receiver_shipping_order` path) — giving the "PO history / PO status / send PO to merchant" behavior this spec wants, without a second place that creates or mutates money-moving state. Same non-negotiable principle `TASK3.md` already established for the request-to-order step: the staging/paperwork layer is new and fine to build; the actual order/wallet RPC underneath it is not touched.

### Suggested build order, if this moves forward

1. `purchase_orders` audit table + trigger off existing order creation (low risk, additive, no schema conflicts).
2. `standard` delivery adapter (OSRM + `calculate_standard_shipping`) as a second tier behind Lalamove — resolve the self-hosting question above first, since building against the public demo server would need re-pointing later anyway.
3. Leaflet route visualization in the existing Checkout/Order-detail views, fed by whichever adapter won the quote.
4. Only then revisit whether a literal module/service boundary (vs. the current shared-registry pattern) is worth the added complexity — the registry pattern already satisfies "reusable, no direct dependency on Customer/Reseller/Merchant" today.