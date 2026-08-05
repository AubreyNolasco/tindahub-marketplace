# Customer Storefront Ordering — Progress & Handoff

Tracker for the new feature request: let a customer place an order directly on a Reseller's public storefront (with a product-detail popup), have the Reseller see the request with the customer's contact/address in their own dashboard, and have the Reseller convert it into a real order using the existing, unchanged wallet-safe checkout flow. Also includes a smaller related fix: storefront links falling back to a raw UUID instead of the Reseller's name.

**Full design doc / rationale**: `C:\Users\Nhico\.claude\plans\iterative-imagining-deer.md` — read that first if picking this up cold, this file is just the checklist.

**Non-negotiable constraint**: order creation itself (wallet debit, escrow, fees) must stay on the existing `quote_order` → `place_customer_receiver_shipping_order` → `place_order` path. Nothing in this feature creates a new payment/money path — "converting" a request just feeds the existing Cart → Checkout flow.

**After every batch**: `npm run build && npx eslint . && npm test`, commit, push, `gh run watch` for CI green. Any batch with a migration also needs `supabase db push` (and a sanity check via `supabase db query`) before the next batch starts, since later batches depend on the schema/RPC being live.

## 🔧 Batches — in order

- [ ] **Batch 1 — Fix storefront slug fallback.** Root cause: `set_reseller_storefront_slug()` trigger (`20260723002100_reseller_store_name_links.sql`) only fires when `storefront_name` is set; a one-time backfill covered resellers that existed as of 2026-07-23, but anyone who signed up after and never opened "My Product List" still has no slug, so their share link falls back to `/reseller-store/:id`. Fix: (1) re-run the backfill for any reseller currently missing a slug, (2) make the trigger self-healing on INSERT so this can't recur. Confirms the pasted URL (`/reseller-store/bc37187b-45a6-43c1-8d1a-c78eec29a939`) now resolves to a name-based `/store/:slug` link.
- [ ] **Batch 2 — `storefront_order_requests` table + `submit_storefront_order_request` RPC.** New table (pending/accepted/declined/converted status), RLS (owner-only select/update, no direct insert for anyone), and the app's first anon-write RPC — validates the reseller/product/quantity, sanitizes inputs, and reuses the IP-rate-limit guard pattern from `guard_public_appointment_submission()` (`launch_security_audit_fixes.sql`) against abuse.
- [ ] **Batch 3 — Storefront modal rework.** Replace `ResellerStorefront.jsx`'s current contact-instructions-only "buying" modal with a 3-view modal (product detail → order form → confirmation), opened on product-card click. Contact-channel links kept as a secondary fallback inside the detail view.
- [ ] **Batch 4 — Reseller "Customer Orders" inbox.** New `Reseller/StorefrontOrderRequests.jsx` page (list + status filter + detail modal, modeled on `MyReferrals.jsx`/`MerchantFollowups.jsx`). Accept/Decline update status directly; Convert finds-or-creates a `customers` row, calls the existing `useCart().addItem(product, qty, customer, price)`, and sends the Reseller to `/reseller/cart` to finish the unmodified checkout flow. New nav entry in `ResellerLayout.jsx`.
- [ ] **Batch 5 — End-to-end live verification.** Chrome automation against the deployed site: submit a real request as an anonymous customer, confirm it shows correctly in the Reseller's inbox, accept → convert → confirm it lands in Cart with the right customer/product/qty, confirm the request shows `converted` afterward. Also re-verify the Batch 1 slug fix on the actual pasted URL.

## Out of scope for this pass (flagged, not built — see plan doc for why)

- SMS notification to the Reseller on a new request (pattern exists via `send-sms`, cheap to add later).
- A customer-facing "check my request status" page (no customer account exists; Reseller calls back).
- Cloudflare Turnstile on the new public RPC (available in-app for auth only today; would be new plumbing).

## Notes for whoever picks this up next

- This is a genuinely new feature (new table, new anon-write RPC, new pages) — unlike the earlier `TASK2.md` UI/UX pass, business-logic changes ARE in scope here, but only the *staging* layer in front of ordering. Never modify `quote_order`/`place_order`/`place_customer_receiver_shipping_order` as part of this work.
- The plan file has exact file:line citations for every existing pattern being reused (cart, customers table, modal shell, nav config, rate-limit guard) — read it before re-deriving anything from scratch.
