# JOM HUB — Full System Workflow

Text-based directional flowcharts (│ ▼ ┌─┴─┐) covering every process in the JOM HUB marketplace, from signup to money settling in a wallet. Mirrors the in-app canonical references — `/admin/system-flowchart/full` (`FullSystemFlowchart.jsx`) and `/admin/process-guide` (`ProcessGuide.jsx`) — and the module breakdown in `TASK8.md`. If a workflow changes in the app, update this file too.

---

## 1. FULL SYSTEM FLOW — Signup to Settlement

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
                    │                                            │
        Submit Business Permit                        Verify Identity (Gov ID + Selfie)
        + Subscription Request                         + Initial Wallet Top-Up
        (free 6-month starter auto-granted)
                    │                                            │
                    └─────────────────────┬─────────────────────┘
                                          ▼
                                ADMIN — Review & Verify
                          (identity, payment, amount, reference)
                                          │
                             Permit + Subscription  OR
                              ID + Top-Up Approved?
                    ┌─────────────────────┴─────────────────────┐
                    │                                            │
                   No                                           Yes
                    │                                            │
       Reject with corrective note                    ACCOUNT APPROVED
       (resubmit; existing active                    (can now transact —
        account is never affected)                  browsing was never blocked)
                                                                  │
                                                                  ▼
                                                   ┌── Merchant may request
                                                   │   temporary access while
                                                   │   permit is still pending
                                                   │   (time-bound, Admin-set)
                                                   ▼
                              MERCHANT — Add Product to Catalog
                        (photos, stock, wholesale/retail price, qty tiers)
                                          │
                                          ▼
                       ADMIN — Monitor Listings / Moderation
                          (block illegal, counterfeit, unsafe,
                                misleading listings)
                                          │
                                          ▼
                            PUBLISHED TO CATALOG
                    (visible to every approved Reseller,
                     one-piece + bulk profit estimates shown)
                                          │
                                          ▼
                            An order starts one of two ways
                    ┌─────────────────────┴─────────────────────┐
                    │                                            │
                CUSTOMER                                     RESELLER
             (no account needed)                         (wholesale buyer)
                    │                                            │
       Opens Reseller's public storefront link            Browses Merchant Catalog
                    │                                            │
             Create Order Request                     Add to Cart (qty, optional
        (qty, name, phone, address)                   customer selling price)
                    │                                            │
                    ▼                                            │
          Customer Order Queue                                   │
       (lands in Reseller's inbox)                                │
                    │                                            │
                    ▼                                            │
                RESELLER                                          │
                    │                                            │
       View Customer Order Details                                │
        - Ordered Items                                           │
        - Customer Name                                           │
        - Contact Number                                          │
        - Delivery Address                                        │
        - Shipping Fee Estimate                                   │
                    │                                            │
                    ▼                                            │
         Contact / Verify Customer                                │
                    │                                            │
             Order Confirmed?                                     │
          ┌─────────┴─────────┐                                  │
          │                   │                                  │
         No                  Yes                                 │
          │                   │                                  │
  Cancel / Hold Order   Convert to Cart                            │
   (dead end)          (find/create customer)                     │
                          │                                       │
                          └───────────────────┬───────────────────┘
                                              ▼
                                    CART (both paths merge here)
                                              │
                                              ▼
                        SYSTEM — quote_order() Server Quotation
                     (subtotal + ~1% Reseller fee, ₱3-₱50 cap,
                      + Merchant success fee shown for reference —
                        price is NEVER trusted from the browser)
                                              │
                                              ▼
                          RESELLER — Pay & Place Order
                                              │
                                              ▼
                     SYSTEM — place_order(): re-checks stock,
                       price, account access, wallet balance
                                              │
                                              ▼
                    WALLET DEBITED IMMEDIATELY — HELD AS ESCROW
                         (Merchant is NOT paid yet)
                                              │
                                              ▼
                     PURCHASE ORDER AUTO-GENERATED
                (1:1 audit record, PO-YYMMDD-XXXXXX,
                 status always mirrors the live order — no drift)
                                              │
                                              ▼
                                        MERCHANT
                                              │
                                              ▼
                          Receive Purchase Order (order: Confirmed)
                                              │
                                              ▼
                              Review Order Details
                                              │
                                              ▼
                       Move to Processing → Prepare / Pack Items
                                              │
                                              ▼
                         Submit Actual Courier Fee for Confirmation
                                              │
                                              ▼
                                RESELLER — Accept fee?
                          ┌───────────────────┴───────────────────┐
                          │                                        │
                    Decline (note ≥5 chars)                       Yes
                          │                                        │
              Merchant may revise fee ──────────────────┐          │
                          ▲                              │          │
                          └──────────── back to Accept? ─┘          │
                                                                     ▼
                                                          READY FOR SHIPMENT
                                                     (dispatch stays locked
                                                      until fee accepted)
                                                                     │
                                                                     ▼
                                                        SHIPPING MODULE
                                             Pickup Address → Route → Delivery Address
                                          (haversine distance, PSGC + Leaflet pins only —
                                                no external geocoding/routing API)
                                                                     │
                                                                     ▼
                                                   Ship Method?
                          ┌───────────────────────────┴───────────────────────────┐
                          │                                                        │
                   Ship Manually                                        Book via Lalamove
              (tracking #, provider,                              (quote tried: Merchant's
                estimated delivery)                                account → Reseller's →
                                                                    Platform's; books once
                                                                    Reseller accepts quote)
                          │                                                        │
                          └───────────────────────────┬───────────────────────────┘
                                                       ▼
                                          DELIVERY / COURIER — In Transit
                                                       │
                                                       ▼
                                                  CUSTOMER / RESELLER
                                             receives the shipment
                                                       │
                                                       ▼
                                    RESELLER checks items / 7-day silent window
                          ┌─────────────────────────────┴─────────────────────────────┐
                          │                                                            │
                  Opens Order Case                                          Confirms OK, or no
              (dispute / return / replacement)                          action for 7 days after ETA
                          │                                                            │
                          ▼                                                            │
              ADMIN resolves case                                                       │
             (needs delivery evidence                                                   │
                 if already shipped)                                                    │
                          │                                                            │
                 Approved cancellation?                                                 │
          ┌───────────────┴───────────────┐                                            │
          │                                │                                            │
         Yes                              No                                            │
          │                                │                                            │
   Wallet charge returned,          Case closed,                                        │
   Reseller fee reversed,           order proceeds                                      │
   stock restored (once)                as-is ──────────────────┐                       │
          │                                                      │                       │
          ▼                                                      ▼                       ▼
  RESELLER REFUNDED IN FULL                              ────────────── ORDER COMPLETED ──────────────
   (delivery skipped entirely)                                              │
                                                                             ▼
                                                            SYSTEM — Settlement
                                                    Merchant wallet credited: subtotal
                                                       minus 3% Merchant success fee
                                                    (posts once; Reseller's ~1% fee was
                                                       already collected at checkout)
```

---

## 2. Wallet Funding & Cashout Loop

Runs independently of the order flow above — every Reseller and Merchant wallet feeds from here.

```
                    TOP-UP (money in)                        WITHDRAWAL (money out)
                          │                                            │
                          ▼                                            ▼
           User submits amount, method,                  User requests withdrawal
          one-use reference, private proof             (min ₱500, cap ₱100,000/day,
                          │                              24h after payout-detail change)
              Manual or Online payment?                                │
          ┌───────────────┴───────────────┐                            ▼
          │                                │                Wallet debited immediately
       Manual                          Online (PayMongo)           (funds held)
          │                                │                            │
          ▼                                ▼                            ▼
   Admin reviews &                 Payment webhook              Admin approves
     approves                       auto-approves                or rejects?
          │                                │                ┌───────────┴───────────┐
          └───────────────┬────────────────┘                │                       │
                          ▼                               Approved                Rejected
                  WALLET CREDITED                            │                       │
              (same trigger, either path)                    ▼                       ▼
                                                  Admin schedules transfer,   Held amount
                                                  uploads proof, unique          auto-returned
                                                  reference, marks Sent
```

---

## 3. Cancellation, Dispute & Refund (detail)

```
                        Buyer or Merchant opens a case
              (cancellation / dispute / return / replacement / refund)
                                    │
                                    ▼
                    Open case pauses automatic completion
                                    │
                                    ▼
                          Order already shipped?
                    ┌───────────────┴───────────────┐
                    │                                │
                   No                               Yes
                    │                                │
        Merchant may review               Admin resolves — requires
         & resolve directly                  delivery evidence
                    │                                │
                    └───────────────┬────────────────┘
                                    ▼
                              Case approved?
                    ┌───────────────┴───────────────┐
                    │                                │
                   Yes                               No
                    │                                │
     Wallet charge returned,                 Case closed,
     Reseller fee reversed,               order proceeds as-is
      stock restored (once)
                    │
                    ▼
        Admin records resolution;
      ledger + evidence retained
```

---

## 4. Merchant Subscription Renewal

```
              Merchant chooses Starter, Growth, or Pro plan
                                │
                                ▼
             Submits payment reference + private proof
                                │
                                ▼
                Admin confirms receipt, reviews once
                                │
                          Approved?
                    ┌─────────────┴─────────────┐
                    │                             │
                   No                            Yes
                    │                             │
        Reject the request only —      Renewal extends from the LATER
        never an existing active         of current expiry or today
              account                    (no lost remaining days)
                                                    │
                                                    ▼
                                    Subscription revenue + tax reserve
                                        posted to platform ledger
```

---

## 5. Admin Daily Oversight

```
                    Open Admin Dashboard, refresh
                                │
                                ▼
              Follow "Recommended Next Action" card
                                │
                                ▼
        Clear queues in priority order:
   Merchant apps → Subscriptions → Top-ups →
      Withdrawals → Registrations
                                │
                                ▼
              Inspect open Order Cases
                                │
                                ▼
        Check Activity Audit (filter by record
       type / actor / ID, old vs new status)
                                │
                                ▼
             Check Platform Wallet totals
                                │
                                ▼
      Reconcile against actual bank/e-wallet
       statement — investigate duplicate,
      missing, reversed, or oversized entries
```

---

## 6. Content, Compliance & Security

```
   HOMEPAGE UPDATE                POLICY PUBLISHING            SECURITY INCIDENT
         │                              │                              │
         ▼                              ▼                              ▼
Review current banners/       Create new Draft version        Record exact error, role,
sections vs. live fees,                │                        page, reference, time
plans, login, workflows                ▼                              │
         │                     Review legal text, dates,               ▼
         ▼                       fees, contact details          Pause the affected
Update copy / images,                  │                       approval or transaction
preview desktop + mobile               ▼                        (do not retry blindly)
         │                     Preview mobile + desktop                │
         ▼                              │                              ▼
   Save → verify on                     ▼                    Check Activity Audit, Login
   live production page          Publish — previous            History, Supabase logs
                                 version archives                      │
                                     automatically                     ▼
                                          │                  Preserve evidence, apply
                                          ▼                  smallest controlled fix
                                Export & retain approved              │
                                   HTML/PDF copy                      ▼
                                                              Reconcile impact, notify
                                                             users, document closure
```

---

## Notes

- **Backend is the sole source of truth for pricing.** `quote_order()` / `place_order()` always recompute server-side — the price shown to a Reseller is never trusted from the client.
- **Distance is straight-line (haversine)** between the Merchant's pickup pin and the delivery pin — PSGC + Leaflet only, no external geocoding/routing API (`TASK11.md`). `TASK8.md` explored an OSRM road-distance alternative as a free/open-source "Shipping Module" adapter; the production path stayed haversine + Lalamove.
- **Purchase Order is an audit artifact, not a second order system** — it's generated 1:1 with every order and always reads its status live off `orders`, so it can never drift out of sync (`TASK8.md`).
- The teal/escrow rule: money leaves the Reseller's wallet at Checkout and only reaches the Merchant at Settlement. Cancelling anywhere before Settlement sends it back to the Reseller instead of waiting for delivery.
- This file is the version-controlled counterpart to the live in-app flowcharts at `/admin/system-flowchart`, `/admin/system-flowchart/full`, and `/admin/process-guide` — update both when a workflow changes.
