# Enterprise Promotion Management System — Progress & Handoff

**Status: Phase 1 (Analyze) complete, written up below and delivered to the user in-chat. Blocked on user approval before any code is written — per the user's own explicit workflow rules ("Analyze first. Wait for my approval. Never implement multiple phases without my approval.").**

Upgrading the existing manual, merchant-wide, admin-only Campaign module (`campaigns` + `merchant_campaigns` tables, `src/pages/Admin/Campaigns.jsx`, `src/pages/Merchant/Campaigns.jsx`, `src/utils/campaigns.js`, `src/utils/pricing.js`) into a per-product, automated, validated, scheduled promotion engine with vouchers, banners, badges, bulk import/export, and checkout-time enforcement — while reusing the existing architecture (RLS, security-definer RPCs, `revenue_settings`/`quote_order`/`place_order` pattern, Admin `DataTable`/`EmptyState`/`Spinner` UI kit, `merchant_status`-style enum + trigger notification pattern) rather than replacing it.

## Phase 1 — Analysis (complete)

Full architecture read-through of: `campaigns_migration.sql`, `automatic_calendar_campaigns_migration.sql`, `src/pages/Admin/Campaigns.jsx`, `src/pages/Merchant/Campaigns.jsx`, `src/utils/campaigns.js`, `src/utils/pricing.js`, `src/components/product/ProductCard.jsx`, `src/contexts/CartContext.jsx`, `src/pages/Reseller/Checkout.jsx`, the live `quote_order()` and `place_order()` function bodies (queried directly from the linked database — the on-disk migration history for `place_order` is fragmented across 8 loose, non-timestamped `.sql` files, so the live `pg_proc` definition was used as the source of truth), and the `products` table schema.

**Most important finding — a live, currently-shipping bug, not just a gap:** campaign discounts are computed and displayed **client-side only** (`utils/campaigns.js` → `campaign_discount_percent` on the cart item → `utils/pricing.js`'s `getUnitPrice`). The actual money-moving RPC, `place_order()` (called via `place_receiver_shipping_order`/`place_customer_receiver_shipping_order`), recomputes `unit_price` from `product.price`/`wholesale_price` + `discount_tiers` only — it never reads `campaigns`, `merchant_campaigns`, or any campaign discount. **A shopper sees "20% OFF" in their cart and is charged full price at checkout.** A `product_unit_price()` SQL function exists that *does* include the campaign discount, but it is dead code — nothing calls it. This must be fixed as part of Phase 9 (Automatic Promotion Engine) at the latest, and is flagged as a candidate for an earlier, isolated hotfix given it's a real financial-trust bug independent of the rest of this project.

**Other findings, delivered to the user in full in-chat (not duplicated here — see conversation):**
- Campaigns today are whole-merchant flat-percent-off (join = every active product in the store gets the same % off), not per-product — no product selection, no per-product campaign price, no SKU-level opt-in/out.
- Joining a campaign is instant/automatic with no submission, no approval workflow, no validation (stock, pricing floor, conflicting campaigns) — "mostly manual" in the request actually undersells it; there's no merchant-submission concept to be manual *about* yet.
- No Voucher module exists anywhere in the codebase (grepped `voucher|promo_code|discount_code` across `src/` — zero matches). Phase 10 is net-new, not an improvement of something existing.
- No banners, no homepage featured-campaign section, no countdown timers, no category-page ribbons, no merchant-store campaign collection. The only existing visual surface is a small corner badge on `ProductCard.jsx` ("CAMPAIGN 20% OFF"), derived from the same client-only discount number.
- No real scheduler. `ensure_recurring_campaigns()` (which seeds the Payday/Double Day recurring campaigns) is only invoked lazily, client-side, every time an admin happens to open `Admin/Campaigns.jsx` — not on a `pg_cron` schedule. If no admin opens that page, next month's calendar campaigns silently never get created.
- `products` table has zero campaign-linkage columns — confirms campaigns are merchant-level only today, consistent with the above.
- Reusable patterns identified for Phases 2–13: the `merchant_status` enum (`pending/approved/rejected/suspended`) + trigger-notify-on-transition pattern already used for merchant approval is the right template for the new `Draft/Pending/Approved/Active/Paused/Rejected/Expired/Archived` submission status; `quote_order()`/`place_order()`'s security-definer, server-recomputes-everything pattern is the right template for closing the pricing-bug gap and for the Phase 9 promotion engine; the generic Admin `DataTable` + `Integrations.jsx`-style credential/config form pattern (already proven for 10+ provider integrations) is a good fit for Phase 13's rule/pricing configuration screens instead of building bespoke forms.

## Next step

Present the above analysis to the user (done, in conversation) and get explicit go-ahead before touching Phase 2 (Merchant Campaign Center) or any other phase. Per the user's rules: implement one phase at a time, test before moving to the next, never batch phases without approval.

## Phase checklist (from user's spec — none started, all pending approval)

- [ ] Phase 2 — Merchant Campaign Center (submission workflow, statuses, performance view)
- [ ] Phase 3 — Product validation engine
- [ ] Phase 4 — Pricing rule engine (min campaign price, suggested price)
- [ ] Phase 5 — Bulk import (Excel/CSV)
- [ ] Phase 6 — Bulk export (Excel/CSV)
- [ ] Phase 7 — Automatic campaign enrollment (schedule-driven activation)
- [ ] Phase 8 — Automatic campaign benefits (banners, badges, highlighting across homepage/search/category/PDP/store)
- [ ] Phase 9 — Automatic Promotion Engine (checkout-time enforcement — also where the live pricing bug above gets closed)
- [ ] Phase 10 — Voucher Engine (net-new module)
- [ ] Phase 11 — Campaign Scheduler (real `pg_cron`-driven activate/deactivate/expire)
- [ ] Phase 12 — Notifications (reuse existing `notifications` table from the integrations scaffolding)
- [ ] Phase 13 — Admin Center upgrades (create/edit/duplicate/pause/resume/archive, approve/reject submissions, rule config, reports)
