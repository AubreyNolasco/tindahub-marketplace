# Enterprise Promotion Management System — Progress & Handoff

**Status: Phase 1 (Analyze) and Phase 2 (Merchant Campaign Center — submission/approval workflow) are complete and deployed live. Blocked on user approval before starting Phase 3.**

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

## Phase 2 — Merchant Campaign Center (complete, deployed, tested live)

**Design decision (user deferred to recommendation):** the existing whole-store "instant join" flow (`campaigns`/`merchant_campaigns`, `Merchant/Campaigns.jsx`'s "Join campaign" button) is left completely untouched and keeps working exactly as before — used going forward for the system-generated recurring campaigns (Payday/Double Day), which are low-stakes fixed discounts with no need for per-product control. The new per-product submission+approval flow is additive, for merchant-initiated campaigns needing pricing control and review.

**Built:**
- Migration `20260806001200_campaign_products.sql` — new `campaign_submission_status` enum (`draft/pending/approved/active/paused/rejected/expired/archived`), new `campaign_products` table (campaign_id, merchant_id, product_id, campaign_price, status, validation_errors, rejection_reason, submitted_at/reviewed_at/reviewed_by), additive `requires_approval`/`min_discount_percent`/`max_discount_percent` columns on `campaigns` (existing rows unaffected — all default/nullable), RLS mirroring the existing `merchant_campaigns` policy shape.
- RPCs: `submit_campaign_product()` (runs Phase-3-style inline validation — product ownership/active/stock, campaign schedule, pricing floor/ceiling, overlapping-campaign conflict check — before inserting/updating, returns per-field validation errors instead of one opaque exception), `withdraw_campaign_submission()`, `review_campaign_submission()` (admin-only approve/reject).
- `Merchant/Campaigns.jsx` — added a "Submit individual products" collapsible panel per campaign card: product picker, campaign price input, submission list with status badges, edit price / withdraw actions, inline validation-error display. Existing "Join campaign (whole store)" button untouched.
- `Admin/Campaigns.jsx` — added a "Pending product submissions" panel above the existing campaign grid, with Approve/Reject actions. Existing campaign create/toggle UI untouched.
- Migration `20260806001300_fix_review_campaign_submission_enum_cast.sql` — hotfix found during live testing (see below).

**Live-tested end-to-end** using the "Admin Demo Merchant" account (same login, dual admin+merchant identity, already set up in this project for exactly this kind of testing) against the deployed production site, with a temporary SQL-seeded test product (cleaned up after):
1. Submitted a product at ₱85 (from ₱100) to the "8.8 Double Day Sale" campaign → correctly landed in **Pending** (campaign has no `min/max_discount_percent` set, so no validation errors; `requires_approval` defaults `true`).
2. **Bug found and fixed live:** `review_campaign_submission()`'s `UPDATE ... SET status = (CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END)` failed with `42804 column "status" is of type campaign_submission_status but expression is of type text` — a `CASE` expression embedded directly in an `UPDATE`'s `SET` clause doesn't get the implicit enum cast that a typed PL/pgSQL variable assignment gets (confirmed `submit_campaign_product`'s `v_status := CASE ...` into a `campaign_submission_status`-typed variable was unaffected). Fixed with an explicit `::public.campaign_submission_status` cast, redeployed, reverified.
3. Re-tested Approve → **Approved** on both Admin and Merchant screens.
4. Tested Withdraw → correctly disappears from the merchant's active submission list (status → `archived`).
5. Cleaned up the temporary test product and submission row from the database.

## Next step

Get explicit go-ahead before starting Phase 3 (Product Validation Engine — note most of its checks were actually already built into `submit_campaign_product()` above as part of Phase 2; Phase 3 proper is likely just extending/surfacing that validation further, worth confirming scope with the user before starting). Per the user's rules: implement one phase at a time, test before moving to the next, never batch phases without approval.

## Phase checklist (from user's spec)

- [x] Phase 2 — Merchant Campaign Center (submission workflow, statuses; performance view deferred — needs Phase 9's checkout-campaign wiring to attribute orders to a campaign accurately, see note below)
- [ ] Phase 3 — Product validation engine (core checks already landed in Phase 2's `submit_campaign_product()`; confirm remaining scope with user)
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

## Note on "campaign performance view" (mentioned in Phase 2's spec, not yet built)

`order_items` has no `campaign_id` column today, so there's no exact way to attribute a past order to a specific campaign submission. A best-effort view (join `order_items` → `products` → `campaign_products`, filtered by the order's `created_at` falling inside the campaign's date range) would be approximate and could misattribute orders placed on a product that happens to also be in another campaign at the same time. Recommend building the real version once Phase 9 (checkout) is wired to campaign pricing — at that point `place_order()` can stamp the actual `campaign_id` onto each `order_item` at the moment of sale, giving exact attribution for free.
