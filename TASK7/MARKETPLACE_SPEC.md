# JOM HUB — Marketplace Spec, API/Security/Performance/SEO/Testing Rules

## Marketplace Requirements

The Marketplace module (see `PROJECT_ARCHITECTURE.md`) is the customer-facing shopping/booking experience:

- **Products** — `Catalog.jsx` (browse/search/filter), `ProductDetail.jsx` (single product, campaign badges/pricing).
- **Merchant Stores** — a Merchant's public product listing surface, reviews/ratings (existing `Reviews & Ratings` merchant page and its customer-facing counterpart).
- **Services / Referral Platform** — Clinic Referral and Real Estate Referral are a distinct booking/appointment flow, not physical-goods checkout; keep their data model (bookings/appointments) separate from `orders`/`order_items`.
- **Reseller Storefronts** — `ResellerStorefront.jsx`, a public slug-based page where a Reseller's own customers shop and submit `storefront_order_requests` without needing a login.
- **Discounts / Flash Sale / Campaigns** — see `TASK6.md` for the full current build-out (per-product campaign submissions, pricing rules, scheduler, and — once Phase 9 lands — real checkout-time enforcement). "Flash Sale" and "Seasonal Campaign" are `campaign_kind` variants of the same underlying `campaigns`/`campaign_products` model, not separate tables.
- **Checkout** — `Reseller/Checkout.jsx`, always server-quoted (`quote_order` RPC) before the actual charge (`place_order` and its wrappers) — the displayed price is never trusted as the charged price.

## API Rules

- **No custom REST API layer.** This app talks directly to Supabase's auto-generated PostgREST API (`supabase.from('table')...`) and RPCs (`supabase.rpc('function_name', {...})`) via `@supabase/supabase-js`. Don't introduce a separate Express/Next-API-route backend — it would duplicate what PostgREST + RPCs already do, against the reuse-first policy.
- **Edge Functions only when a server-held secret is required** (calling a third-party API with a key that must never reach the browser — Cloudinary signing, Google Drive proxying, SMS/AI provider calls). Written in Deno, plain `fetch`, no npm SDKs bundled — matches every existing function under `supabase/functions/`.
- **`service_role` key never ships to the client.** It exists only inside Edge Functions / the Supabase CLI's own session — the browser always talks through the `anon` key + RLS + RPCs.
- **RPC naming:** verb_noun style matching what's already there (`place_order`, `quote_order`, `submit_campaign_product`, `review_campaign_submission`) — not REST-y noun-only names.

## Security Rules

- RLS enabled on every table with user or financial data (see `BUSINESS_RULES.md`); a table shipped without RLS is a blocker, not a follow-up.
- All privileged writes (money, stock, another party's data, approvals) go through `security definer` RPCs that re-check `auth.uid()` / `is_admin()` / ownership themselves — the RPC is the security boundary, not the calling UI.
- Storage buckets scoped per-owner via `storage.foldername(name)`-based policies (the pattern already used for payment proofs, business permits, order-case evidence) — a user can only read/write their own folder, plus admin override.
- Secrets (API keys, tokens, webhook secrets) live only in Supabase Vault via `integration_configs`; never in a plaintext column, git history, or client bundle.
- Auth is OTP email-code based (no passwords to leak/reuse) — don't add a password field "for convenience" without a specific reason and explicit sign-off, since it would be a real regression in this app's threat model.

## Performance Rules

- **Batch independent reads with `Promise.all`** — the established pattern across every dashboard page (e.g. `Merchant/Campaigns.jsx` loading campaigns + joined-status + products + submissions in one `Promise.all`) instead of sequential awaits.
- **Join, don't N+1.** Use PostgREST's embedded-resource syntax (`select('*, related_table(columns)')`) to fetch related rows in one request instead of a query-per-row loop.
- **Index every foreign key and every column used in a `WHERE`/`ORDER BY` on a table expected to grow** — see `campaign_products`' `idx_campaign_products_campaign/merchant/product` as the reference pattern for a new table.
- **Paginate/limit lists that scale with merchants or orders** rather than fetching unbounded result sets — the existing `DataTable` component's `pageSize` prop is the established mechanism.
- Designing for "thousands of merchants, hundreds of thousands of products" means: no full-table scans in a hot path, no client-side filtering of an unbounded server result set, and campaign/promotion logic evaluated set-based in SQL (as `run_campaign_scheduler()` does) rather than row-by-row from the client.

## SEO Rules

SEO only matters where an unauthenticated visitor lands from a search engine or shared link — the Landing website and public Reseller/Merchant storefront pages. It does not apply to anything behind Authentication (Business Panel dashboards).

- Semantic HTML (proper heading hierarchy, `<title>`/meta description per public page) on Landing and storefront pages.
- Public storefront links (`/store/:slug`-style) should resolve to a real, crawlable page even for a visitor with no account — this is already the behavior for the reseller storefront link fix documented in `TASK3.md`/`TASK4.md`.
- Don't add SEO machinery (sitemaps, structured data, etc.) to authenticated dashboard routes — wasted effort, and a mild information-leak risk if it exposes route structure.

## Testing Rules

- CI (`.github/workflows`) runs `npm test`, `npm run build`, and `npx eslint .` on every push to `main` — a change isn't done until CI is green.
- **Live verification before considering a feature done**, using the existing "Admin Demo Merchant" account (same login has both an admin profile and a merchant profile, purpose-built for exactly this) to exercise real Merchant/Reseller flows without needing a second real account. See `TASK6.md`'s Phase 2/7/11 write-ups for the reference pattern (submit → approve → verify both sides → withdraw → clean up test data).
- Any test/seed data created for verification is deleted afterward unless it's an intentional persistent fixture (sample product catalog, recurring calendar campaigns) — don't leave `TEST ...`-prefixed rows sitting in production data.
- Bugs found *during* live testing get fixed and re-verified in the same pass, not filed for later — see the enum-cast bug and the validation-rollback bug in `TASK6.md`, both caught by actually clicking through the feature rather than only reading the code.

## Development Phases

This project's actual working rhythm (see `TASK1.md` through `TASK6.md` for the real history) is:

1. **Analyze** the relevant existing code/schema before writing anything.
2. **Design additively** — reuse what exists, add only what's missing, preserve backward compatibility.
3. **Build** (migration → RPC → frontend, in that order, since the RPC is the contract the UI is built against).
4. **Deploy** (migration pushed to the linked Supabase project; frontend committed + pushed to `main`, auto-deployed by Vercel).
5. **Test live** against the deployed site, fix anything found, redeploy.
6. **Document** the outcome in that feature's `TASKn.md` — what was built, what was found/fixed, current status — so the next session (human or AI) has an accurate paper trail instead of having to re-derive it from git history.

## Acceptance Criteria

A change is "done" when **all** of the following are true:

- [ ] CI is green (tests, build, lint).
- [ ] Every new/changed table has RLS; every new privileged write is a `security definer` RPC.
- [ ] No existing table, RPC, RLS policy, or user-facing flow was modified in a way that breaks its current behavior for existing users — additive only, per `BUSINESS_RULES.md`.
- [ ] The feature was exercised live on the deployed site (not just "the build succeeded"), and anything found broken was fixed and re-verified.
- [ ] Any test/seed data created for verification was cleaned up.
- [ ] The relevant `TASKn.md` reflects the true current state — not aspirational, not stale.
- [ ] Mobile-width layout was checked for any new UI, per `UI_UX_GUIDELINES.md`.
