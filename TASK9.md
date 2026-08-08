# TASK7 Compliance Verification — Progress & Handoff

**Status: complete.** `TASK7/` is the project's standing reference (architecture, business rules, marketplace spec, UI/UX guidelines) — it has no work items of its own to finish, so this file exists to record a deliberate audit of this session's work (the Maya/Stripe/PayPal gateways, the Purchase Order module, the free OSRM distance estimate + Leaflet map, and the codebase-wide CORS fix — see `TASK1.md`, `TASK8.md`, `TASKS.md`) against `TASK7/MARKETPLACE_SPEC.md`'s own Acceptance Criteria checklist, item by item, rather than asserting completion informally.

## Acceptance Criteria — checked against this session's changes

- [x] **CI is green (tests, build, lint).** Every push this session passed `.github/workflows/ci.yml`. Verified via `gh run list` after each push, not assumed.
- [x] **Every new/changed table has RLS; every new privileged write is a `security definer` RPC.** `purchase_orders` (new table) has RLS with an owner-scoped policy (`reseller_id = auth.uid() or merchant_id = auth.uid() or is_admin()`); `assign_purchase_order()` and `get_purchase_orders()` are both `security definer`. The Stripe/PayPal `payment_method` enum migration touched no table structure. `route-estimate` is display-only (no table writes at all).
- [x] **No existing table, RPC, RLS policy, or user-facing flow was modified in a way that breaks its current behavior — additive only.** The `trg_assign_purchase_order` trigger only inserts, never blocks an order; `calculate_standard_shipping()` was reused unmodified; the CORS fix *widens* an allow-list (permits a header that was previously silently blocked) rather than restricting anything — no existing caller's behavior changes.
- [x] **The feature was exercised live on the deployed site (not just "the build succeeded"), and anything found broken was fixed and re-verified.** Placed a real order via the app's own Admin-demo role-switch feature (Reseller → Merchant, same account), clicked through to "Free distance estimate," and — because that click surfaced a real bug (every Edge Function's CORS config was missing the `x-jomhub-device-id` header the Supabase client attaches globally) — fixed it live, redeployed all 21 functions, and re-verified the exact same click succeeded end to end (real OSRM distance, real fee suggestion, real Leaflet map with route polyline). See `TASK8.md` for the full write-up.
- [x] **Any test/seed data created for verification was cleaned up.** The test order, its line item, the auto-generated PO row, the wallet debit transaction, and the TEST-prefixed customer were all deleted after verification; confirmed empty via direct query afterward. Deliberately did **not** use `Admin → Test Accounts`' one-click "Delete demo data" — read its underlying `reset_admin_demo_data()` RPC first and found it wipes the *persistent* sample product catalog and zeroes the wallet balance, which is broader than this cleanup needed; did the narrower cleanup by hand instead.
- [x] **The relevant `TASKn.md` reflects the true current state — not aspirational, not stale.** `TASK1.md` carries a top-of-file warning about the CORS bug (since it affects every payment button documented there); `TASK8.md` has the full build + live-verification + bug-fix history; `TASKS.md` has the session summary; this file records the compliance check itself.
- [~] **Mobile-width layout was checked for any new UI.** Partially — see below.

## Mobile-width check: what was actually done

Two new UI surfaces this session: `TopupModal.jsx`'s per-provider online-payment button list, and `ShippingFeeModal.jsx`'s new button row + `RouteMap.jsx`.

Attempted a real mobile-viewport screenshot twice via the browser automation `resize_window` tool (target 390×844, a standard phone size). Both attempts reported success from the tool but the rendered page never actually changed size (screenshot still came back desktop-width), and one attempt crashed the browser tab group outright. This is a tooling limitation in this environment, not something resolved by retrying — confirmed with two independent clean attempts (fresh tab, resize before navigation) before concluding it wasn't going to work here.

In place of a real screenshot, reviewed the actual Tailwind classes shipped:
- `TopupModal.jsx`: each provider button is `w-full` inside a `space-y-3` stack — no fixed widths, no horizontal layout at any breakpoint, inherits the same `max-w-md` modal container every other field in that form already uses safely.
- `ShippingFeeModal.jsx`: the button row is `flex flex-col gap-2 sm:flex-row` — stacks vertically by default (mobile-first) and only becomes side-by-side at `sm:` (640px+), the exact pattern this codebase already documents as its fix for the "brittle flex-row/breakpoint-jump" problem (`TASK4.md`). `RouteMap.jsx` is `w-full` with a fixed pixel height, filling whatever width its parent (the same proven-safe modal container) gives it.

This is a structural, code-level check, not a visual one — flagged honestly rather than claimed as a full pass. If a real device or a working responsive-mode tool becomes available, that's the one item left to actually look at rather than reason about.

## Notes for whoever picks this up next

- `TASK7/` itself needs no maintenance from this pass — nothing in it was found stale or wrong.
- The mobile-width gap above is the only unresolved acceptance-criteria item across all of this session's work. Everything else is fully checked and verified.
