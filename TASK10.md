# Shopee/Lazada-Style Product Display — Progress & Handoff

**Status: built, deployed, live-verified on the deployed site (2026-08-08).**

Request: make the product display (what a Reseller sees browsing products to add to their storefront — `Catalog.jsx`, the shared `ProductCard.jsx`) look like Shopee/Lazada's product grid, while keeping JOM HUB's own architecture and brand identity per `TASK7/`. Scoped down from the original ask (which named both "product display" and "front page") to the Marketplace product-browsing surface specifically, after the owner confirmed the target audience was the Reseller browsing view — not a Landing-page rebrand, which `TASK7/PROJECT_ARCHITECTURE.md`'s "Marketplace must never replace the Business Panel, Landing Website must never replace the Marketplace" rule would have made a much bigger, architecturally riskier change for no stated reason.

## What was built

- **`ProductCard.jsx`** (shared by `Catalog.jsx`, `MerchantStore.jsx`, and `Reseller/StorefrontProducts.jsx` — one component, so all three stay visually consistent per `UI_UX_GUIDELINES.md`'s reuse rule):
  - Discount badge moved from a bottom-right pill to a **corner ribbon, top-left** — the Shopee/Lazada flash-sale-badge position shoppers scan for first.
  - **Strikethrough original price** next to the effective discounted price, shown only for non-reseller viewers (a Reseller's displayed price is their wholesale buying cost, not a retail discount, so mixing in the merchant's retail strikethrough there would misrepresent what they're actually paying — kept the existing reseller pricing logic untouched).
  - Price now computed via `getUnitPrice()` — the same helper `Cart`/`Checkout` already use — instead of showing the raw undiscounted `product.price` for non-reseller viewers, so the badge percentage and the price shown can never disagree with each other.
  - New **star rating + review count + sold count row**, reusing the existing `StarRating.jsx` component (previously only used on `ProductDetail.jsx`). Hidden entirely when a product has no reviews/sales yet, rather than showing "0.0 (0) · 0 sold" clutter on every card.
- **`get_product_sold_counts()` RPC** (`20260808000300_product_sold_counts.sql`): `order_items` is participant-scoped RLS (order owner/merchant/staff only), so a client-side "X sold" aggregate isn't directly queryable by an ordinary shopper. This RPC exposes only a per-product completed-order unit count — no order, customer, or pricing detail — the same public-safe-aggregate posture `product_reviews`' own `for select using (true)` policy already has.
- **`Catalog.jsx`**:
  - Bulk-fetches the ratings aggregate (`product_reviews`, already public-read) and the new sold-count RPC alongside the product query — one join-not-loop query each, batched with the page's existing `Promise.all` pattern, not a per-product loop.
  - New **horizontal category icon row** below the hero search bar — the Shopee/Lazada category-shortcut pattern. Client-side keyword-to-`lucide-react`-icon mapping (`categories` has no icon column, so this is presentational only, no schema change); clicking a category reuses the existing `activeCategory` filter state, no new filtering logic.
  - Grid density bumped slightly at very large screens (`2xl:grid-cols-5`) for more of the "many small tiles" feel; every existing mobile/tablet breakpoint left untouched.
- **`compactCount()`** added to `utils/format.js` (`Intl.NumberFormat` compact notation — "1.2K sold") since the codebase's `format.js` didn't have one and this is the second place it'd be useful (product cards now, review counts later if ever needed).

## What was deliberately not touched

- No pricing, checkout, order, wallet, or RLS logic changed anywhere — this is a display-layer pass only, reusing existing pricing helpers (`getUnitPrice`, `getResellerProfitEstimate`) rather than introducing a second price-computation path.
- No brand/color rebrand — every new element uses the existing `teal`/`mango`/`coral` design tokens (`coral-600` for the discount ribbon and sale price reads as a natural "sale" accent within the existing palette, not a new color introduced for this).
- `ProductDetail.jsx` was not restyled to match — this pass targeted the grid/browsing view specifically, since that's the surface most directly comparable to Shopee/Lazada's product feed. Flagged as a natural follow-up if the single-product page should get the same treatment (price/rating layout) later.
- `MerchantStore.jsx` and `Reseller/StorefrontProducts.jsx` inherit the new `ProductCard` look automatically (shared component) but were not wired up to fetch the ratings/sold aggregates themselves — their cards render correctly, just without the rating/sold row, since that data isn't fetched on those pages yet. Not a bug, just unfinished scope; wiring the same bulk-fetch pattern from `Catalog.jsx` into those two pages is the natural next step if wanted there too.

## Verification

- `npx eslint .` — 0 errors/warnings. `npm run build` — clean. `npm test` — 36/36 passing.
- Migration applied (`get_product_sold_counts` confirmed callable).
- **Live-verified on the deployed site**, in Reseller-demo mode (the exact audience this was built for): category icon row renders and is clickable, discount ribbons show correctly on the campaign products, prices render in the sale-accent color, reseller "Sell/Profit" panel still renders unchanged below. No console errors on page load. Rating/sold row correctly stays hidden for these particular demo products (zero reviews, zero completed orders on this account) rather than showing empty placeholders — confirmed this is the intended graceful-degradation behavior, not a bug.
- Mobile-width visual check **not done this pass** — same tooling limitation recorded in `TASK9.md` (the browser automation's resize tool doesn't actually change the rendered viewport in this environment). The new elements use the same mobile-first Tailwind patterns (`flex-col` defaults, no fixed widths, existing breakpoint scale) already verified structurally sound for the TASK8 work; not yet looked at on an actual narrow screen.
