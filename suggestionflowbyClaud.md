# Suggested & Recommended Flow — Full System (by Claude)

This is a **proposed improvement** on top of `workflow.md` (which documents the flow as it exists today). Nothing here is built yet — it's a recommendation to review before any code changes. Grounded in real gaps already flagged in `TASK11.md`'s own "Reviewed but not changed" section, not invented problems.

---

## What's already solid — do not change

- Escrow timing: wallet debited at Checkout, Merchant paid only at Settlement.
- `purchase_orders` as a pure audit artifact — no independent status column, always reads live off `orders` (`TASK8.md`'s anti-drift design).
- PSGC + Leaflet only, no external geocoding/routing API (`TASK11.md`'s deliberate reversal of an OSRM draft).
- Server-side re-verification of price/stock at every `quote_order()` / `place_order()` call.
- 7-day silent auto-complete with dispute-pause.

---

## Where the current flow actually gets messy

Three concrete, already-known problems — this doc exists to fix these, not to redesign what already works:

1. **"Is this order ready to dispatch?" is answered four different ways.** `DeliveryModal.jsx`, `PurchaseHistory.jsx`, and `Merchant/Orders.jsx` (×2) each independently re-type `order.shipping_payment_method === 'prepaid_wallet'` instead of reading one shared answer. Any future change to what "dispatch-ready" means has to be made in four places and will eventually get missed in one of them.
2. **Automatic pricing fails silently.** When `quote_order()` can't compute an automatic fee (`MISSING_PACKAGE_INFORMATION`, out-of-bounds pin, etc.), the order just falls back to manual/pay-on-delivery with no visible reason. A Merchant whose products are missing weight/dimensions has no in-app way to find out why their orders keep needing manual pricing.
3. **`calculate_standard_shipping()` runs twice per checkout** — once inside `quote_order()` (preview), once inside `place_order()` (charge) — an extra DB round-trip on the hottest path in the app, for a value that hasn't changed between the two calls.

---

## Recommended Full System Flow

Same shape as `workflow.md`'s master flow. Nodes marked **◆ IMPROVED** are what this doc proposes changing; everything else is unchanged.

```
                                        USER
                                          │
                                          ▼
                          Sign Up (Email OTP / Google Sign-In)
                                          │
                                          ▼
                              Choose Role: Merchant or Reseller
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                            │
                MERCHANT                                     RESELLER
           Permit + Subscription                       ID + Initial Top-Up
                    │                                            │
                    └─────────────────────┬─────────────────────┘
                                          ▼
                                ADMIN — Review & Verify
                                          │
                                 ACCOUNT APPROVED
                                          │
                                          ▼
                    MERCHANT — Add Product → Admin Moderates → PUBLISHED
                                          │
                                          ▼
                            An order starts one of two ways
                    ┌─────────────────────┴─────────────────────┐
              CUSTOMER (storefront)                     RESELLER (wholesale)
                    │                                            │
       Reseller reviews, verifies, converts                Add to Cart
                    └─────────────────────┬─────────────────────┘
                                          ▼
                                    CART (merged)
                                          │
                                          ▼
                     ◆ IMPROVED — quote_order() returns a
                       structured pricing_status, not just a number:
                       { status: "automatic", fee, vehicle }              OR
                       { status: "manual_required", reason_code,
                         reason_label }  ← NEW, was silently dropped
                                          │
                                          ▼
                        RESELLER sees a clear line either way:
                    "Delivery Fee ₱X (2.4 km, Motorcycle)"   OR
                    "Fee confirmed after Merchant packs — automatic
                     pricing unavailable: <reason_label>"   ◆ IMPROVED
                                          │
                                          ▼
                          Pay & Place Order → Wallet Debited (Escrow)
                                          │
                                          ▼
                          Purchase Order Auto-Generated (unchanged)
                                          │
                                          ▼
                                      MERCHANT
                                          │
                                          ▼
                     Receive PO → Review → Pack Items
                                          │
                                          ▼
                     ◆ IMPROVED — Merchant sees the SAME reason_label
                       from checkout right here if pricing fell back
                       to manual (today: has to guess why)
                                          │
                                          ▼
                              Pricing path already decided at Checkout?
                    ┌─────────────────────┴─────────────────────┐
                    │                                            │
             Automatic (prepaid)                      Manual (needs negotiation)
                    │                                            │
                    │                              Submit Courier Fee → Reseller
                    │                              Accepts / Declines (loop on decline)
                    │                                            │
                    └─────────────────────┬─────────────────────┘
                                          ▼
                     ◆ IMPROVED — ONE computed field decides this,
                       everywhere in the frontend:
                         order.dispatch_ready = true
                       (view/column, computed once in the DB —
                        replaces 4 separate string-comparison
                        checks in DeliveryModal.jsx,
                        PurchaseHistory.jsx, Merchant/Orders.jsx ×2)
                                          │
                                          ▼
                              dispatch_ready = true?
                    ┌─────────────────────┴─────────────────────┐
                    │                                            │
                   No                                           Yes
                    │                                            │
        Blocked — same message                      READY FOR SHIPMENT
        everywhere, one source of truth                          │
                                                                   ▼
                                                      SHIPPING MODULE
                                          Pickup → Route → Delivery (haversine)
                                          ◆ IMPROVED — reuses the ONE distance +
                                            fee already computed at Checkout;
                                            place_order() no longer recalculates
                                            calculate_standard_shipping() a
                                            second time
                                                                   │
                                                                   ▼
                                            Ship Manually  |  Book via Lalamove
                                                                   │
                                                                   ▼
                                            Delivery / Courier — In Transit
                                                                   │
                                                                   ▼
                                          CUSTOMER / RESELLER receives shipment
                                                                   │
                                                                   ▼
                                    Dispute opened, or 7-day silence?
                    ┌─────────────────────┴─────────────────────┐
                    │                                            │
              Order Case → Admin resolves               No dispute / window passes
              → Refund in full, or                                │
                case closed, proceeds ──────────────┐              │
                                                      ▼              ▼
                                              ────── ORDER COMPLETED ──────
                                                          │
                                                          ▼
                                    Settlement — Merchant paid
                                    (subtotal minus 3% success fee)
```

---

## Recommended state machine for `orders` (new)

Today, "where is this order" is read off a mix of `status`, `shipping_fee_confirmation_status`, and `shipping_payment_method` — three columns a reader has to cross-reference. Recommend collapsing the *derived* dispatch question into one generated value, without touching the underlying columns that already work:

```
   confirmed ──▶ processing ──▶ ready_to_ship ──▶ shipped ──▶ completed
                      │               ▲                 │
                      │               │                 ▼
                      └── (manual fee pending/declined) ─┘        order_case_open
                                                          │             │
                                                          └──▶ disputed ┘
                                                                   │
                                                        ┌──────────┴──────────┐
                                                        ▼                     ▼
                                                    refunded              (closed, resumes
                                                                            normal timeline)
```

`ready_to_ship` is the new name for what `dispatch_ready` resolves to — computed the same way regardless of *how* the order got there (automatic prepaid or manual acceptance), so the UI only ever has to check one thing.

---

## Concrete changes — built and verified (2026-08-14)

Before writing any code, re-read the current SQL and frontend (not just this doc's memory of `TASK11.md`) — one item below turned out to be wrong, and analysis changed the shape of another. Both corrections matter more than the original guesses:

- **Dropped: "have `place_order()` reuse `quote_order()`'s already-computed fee."** `place_order()` deliberately recomputes `calculate_standard_shipping()` independently rather than trusting anything from a prior `quote_order()` call — the same "never trust a client-sent fee" rule the whole automatic-pricing feature exists to enforce (see the comment block at the top of `20260813000400_automatic_shipping_checkout.sql`). The "double DB call" isn't a bug, it's the same defense-in-depth pattern already used for price/stock (re-verified at `place_order()` time even though `quote_order()` already checked them). Reusing a prior quote's number would reopen exactly the hole this feature was built to close. Left alone.
- **Narrowed: the "4 duplicated dispatch-ready checks."** On inspection, only one of the four re-derivations was a real risk: `DeliveryModal.jsx`'s client-side submit guard, which re-typed the DB's exact gate condition purely to fail fast before hitting the server. The other three (`Merchant/Orders.jsx`'s list badge and detail panel, both branching on `shipping_payment_method`) aren't duplicated *logic* at risk of drift — they're deliberately distinct copy for "charged automatically" vs. "Reseller accepted a proposed fee," which collapsing into one boolean would have made worse, not better. Left those three as-is.

| # | Change | Where | Status |
|---|---|---|---|
| 1 | `orders.dispatch_ready` — a `generated always as (...) stored` boolean mirroring the exact condition `set_order_delivery()`'s WHERE clause and `enforce_shipping_fee_before_dispatch()` already enforce. Those two functions are untouched; this only materializes their condition as a column that can't drift from what they actually allow. | `20260814000100_dispatch_ready_and_shipping_diagnostics.sql` | ✅ Built |
| 2 | `DeliveryModal.jsx`'s submit guard now checks `order.dispatch_ready` instead of re-deriving `isPrepaid \|\| confirmation === 'accepted'`. | `DeliveryModal.jsx` | ✅ Built |
| 3 | `quote_order()` now captures `sqlerrm` into a new `shipping_fallback_reason` key on its returned jsonb when automatic pricing fails — additive, same signature. `place_order()` already captured the identical value into `orders.shipping_rate_source`; it just never made it into the checkout *preview*. | `20260814000100_...sql` | ✅ Built |
| 4 | New `describeShippingFallback()` helper maps the known SQL exception codes (`MISSING_PACKAGE_INFORMATION`, `MANUAL_QUOTATION_REQUIRED`, etc.) to plain-language messages — restores the mapping `ShippingFeeModal.jsx` used to have before it was dropped along with the old "Free distance estimate" button. | `src/utils/shippingDiagnostics.js` | ✅ Built |
| 5 | Checkout shows *why* automatic pricing isn't available under "Confirmed after ordering," using #3+#4. | `Checkout.jsx` | ✅ Built |
| 6 | Merchant's order-detail "Packaging step" panel shows the same diagnostic, read from `shipping_rate_source`, when it's a real attempted-and-failed reason (not the generic "no pins yet" default). | `Merchant/Orders.jsx` | ✅ Built |

**Verified:** `npx eslint` on all four changed frontend files — 0 errors/warnings. `npm test` — 45/45 passing. `npx supabase db push --dry-run` — migration recognized, nothing else pending.

**Pushed to production** (2026-08-14, `supabase db push` — confirmed clean, no errors).

**Live-verified against the production database** (2026-08-14, via Admin demo mode + direct authenticated REST calls to the live Supabase project):
- `quote_order()` success path: a real quote for a real product/merchant returned `"shipping_status": "calculated"`, `"shipping_fallback_reason": null` — correct, no noise on the common case.
- `quote_order()` failure path: an oversized order (qty forced past the weight/volume threshold) returned `"shipping_status": "pending_manual_quotation"`, `"shipping_fallback_reason": "MANUAL_QUOTATION_REQUIRED"` — the new field works end-to-end against live data, not just in migration-compiles-cleanly theory.
- `describeShippingFallback()` tested against all 4 real shapes it needs to handle (bare code, `place_order()`'s wrapped-string code, the default no-pins string, and `null`) — correct in all four.
- `orders.dispatch_ready` checked against 5+ real historical orders on both sides: `true` for a `prepaid_wallet` order and for `receiver_pays_on_delivery` orders with an accepted manual fee; `false` for orders that never got a confirmation status. Matches `set_order_delivery()`'s gate exactly, retroactively, with no backfill needed (generated columns compute automatically).

**Known gap, found during this pass:** the currently-deployed production frontend (`tindahub-marketplace.vercel.app`) builds from `main`, not `agent/fix-address-map-sync` — same branch-vs-deploy gap `TASK8.md` already flagged for `quote_order()`'s legacy signature. This branch's frontend changes (`DeliveryModal.jsx`, `Checkout.jsx`, `Merchant/Orders.jsx`, `shippingDiagnostics.js`) are correct and lint-clean but **cannot be seen on the live site** until this branch is merged and deployed — confirmed live-testing the checkout page still shows the pre-automatic-pricing "Pay upon delivery" copy from the old, currently-deployed `Checkout.jsx`. The database side (what actually charges money) is live and correct regardless, since Supabase isn't branch-gated the way Vercel is — only the UI is waiting on a merge.

---

## Notes

- This file proposes changes; `workflow.md` documents what's live today. Once/if any of the above is built, fold the change back into `workflow.md` and delete the ◆ IMPROVED markers here (or archive this file).
- Nothing above touches the two hard, already-decided constraints from `TASK11.md`: no external mapping APIs, and automatic pricing as the default path with manual negotiation as fallback-only.
