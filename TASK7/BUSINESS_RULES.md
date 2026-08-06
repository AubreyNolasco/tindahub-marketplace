# JOM HUB — Business Rules

Non-destructive development policy, business logic protection, and the actual rules governing Merchants, Resellers, Customers, and the database, as they exist in the live system today.

## Non-Destructive Development Policy

This is the binding development policy for **every** change to this project, by any contributor (human or AI):

1. **Reuse before creating.** Reuse existing database tables, RPCs, components, hooks, services, and UI patterns before adding new ones. Only create a new table/RPC/component when the existing ones genuinely cannot express the requirement (different entity, different write-path, different security boundary) — not for convenience.
2. **Additive, not destructive.** New columns are nullable or default-valued; new tables don't repurpose an existing table's meaning; new RPCs don't change an existing RPC's signature or behavior for existing callers.
3. **Never silently rewrite working logic.** If an existing implementation looks wrong or outdated, don't "fix" it as a side effect of unrelated work. Flag it, explain the impact, propose a fix, and let it be reviewed as its own change.
4. **Backward compatibility is mandatory.** Existing user flows (whatever role is using them right now) must keep working exactly as before, unless the change *is* that flow's own approved redesign.
5. **Migrations are additive and forward-only.** No editing an already-applied migration file. Fixes to a shipped migration are a new migration, even for a one-line typo.

## Business Logic Protection

- Money-moving logic (wallet debits/credits, order totals, fees) lives **only** in `security definer` Postgres RPCs (e.g. `place_order`, `quote_order`, `mark_withdrawal_sent_with_proof`) — never computed client-side and trusted. The client may *display* a computed estimate, but the server always recomputes authoritatively at the moment of the transaction.
- Row Level Security (RLS) is enabled on every table that holds user data or money. A missing or overly-permissive RLS policy is treated as a security bug, not a convenience.
- Role checks (`is_admin()`, ownership checks like `merchant_id = auth.uid()`) happen inside the RPC/policy, not just in the frontend. The frontend hiding a button is not a security control.
- Existing approval workflows (merchant approval, reseller ID verification, business permit review) are not bypassed by new features. A new feature that needs its own approval step follows the same `pending → approved/rejected` enum pattern already established, rather than inventing a parallel mechanism.

## Merchant Rules

- A Merchant account starts `pending` and must be **approved** by an Admin (`merchant_status` enum: `pending / approved / rejected / suspended`) before their products are visible to the marketplace.
- Merchants manage their own `products` (name, price, wholesale price for resellers, stock, discount tiers, images) and can only ever modify products where `merchant_id = auth.uid()`.
- Every completed order charges the Merchant a **success fee** (percentage, configurable via `revenue_settings`), deducted at the moment `place_order()` runs — not billed separately later.
- Merchants can join platform-wide Campaigns (whole-store instant discount) and/or submit individual products to a campaign for a merchant-set campaign price, subject to admin-configured pricing floors/ceilings and, if the campaign requires it, admin approval. See `TASK6.md` for the full campaign system.
- A suspended or unapproved Merchant's products must not appear to shoppers, even if the product row itself is still `is_active = true`.

## Reseller Rules

- A Reseller buys from Merchants at wholesale price (or the best applicable quantity-tier price) using their internal platform **wallet** — there is no separate checkout payment step; insufficient balance blocks the order (`INSUFFICIENT_BALANCE`).
- Every reseller purchase is charged a **service fee** (percentage, with a configured min/max floor/ceiling) on top of the product subtotal.
- Resellers get a **public storefront** (a shareable slug-based link) where their own customers can browse and place order requests without needing a Reseller-side login.
- A Reseller manages their own `customers` (buyer contacts, with a validated complete address) and their orders/purchase history; a Reseller cannot see or act on another Reseller's customers or orders (enforced via RLS).
- ID verification is a separate, optional trust signal (`Admin → Reseller ID Verification`) — it is not the same gate as being able to transact; a Reseller can already buy/sell before ID verification unless a specific feature is explicitly gated on it.

## Customer Rules

*("Customer" here means the Reseller's or Merchant's end buyer, reached via a public storefront link — not a platform login role.)*

- A Customer does not need an account to submit an order request through a Reseller's or Merchant's public storefront link.
- Order requests submitted this way land in `storefront_order_requests` first — they are a *request*, not a confirmed order, until the Reseller/Merchant reviews and converts it (`submit_storefront_order_request` RPC, converted via the existing order-placement RPCs, never a second/parallel order-creation path).
- A Customer's address and contact info are captured once and reused (`customers` table) rather than re-entered per order, but every address is still validated for completeness (province/city/barangay + street, matching the structured-address pattern used everywhere else in the app) before it can be used to place a real order.

## Database Rules

- **Schema location:** canonical schema lives in `ecommerce-platform/supabase/`. Timestamped files in `supabase/migrations/` are the source of truth for what's actually deployed; loose top-level `.sql` files (`schema.sql`, `*_migration.sql`) are historical/reference and may be out of date — when in doubt, query the **live** function/table definition (`pg_get_functiondef`, `information_schema`) rather than trusting an old file.
- **Naming:** tables/columns/functions in `snake_case`; migration filenames are `YYYYMMDDHHMMSS_description.sql`, always after the latest existing timestamp.
- **Secrets:** third-party API keys/tokens go in Supabase Vault via the existing `integration_configs` + `save_integration_config()`/`get_integration_credentials()` pattern — never a plaintext column, never a `.env` value baked into client code.
- **Enums for status fields:** any new "has an approval/lifecycle state" column follows the existing `pending/approved/rejected(/suspended|expired|archived...)`-style enum convention already used by `merchant_status`, `topup_status`, `payment_status`, and `campaign_submission_status` — not a free-text status column.
- **RPC-only writes for anything money- or stock-affecting:** direct `UPDATE`/`INSERT` from the client is fine for a user's own simple profile-style data; anything touching balances, fees, stock, or another party's data goes through a `security definer` RPC that re-validates everything server-side.
