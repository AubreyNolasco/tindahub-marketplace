# JOM HUB — Admin Guide

This guide covers platform operations for Admin and Staff accounts. It's adapted from the in-app **Admin → Process Guide** page (`/admin/process-guide`), which stays the source of truth — it's interactive, searchable by category, and has a **Print / Save PDF** button for an offline copy. Read this document for the same content in a linear, browsable form.

For account-type concepts (roles, fees, order lifecycle), see the [System Overview](./SYSTEM_OVERVIEW.md). For end-user-facing workflows, see the [User Manual](./USER_MANUAL.md).

---

## Accounts

### Merchant & Reseller Registration
**Owner:** Admin + Applicant

1. Applicant enters an email and verifies the 6-digit OTP.
2. Applicant chooses Merchant or Reseller and completes the required profile, then lands in their dashboard immediately — no separate approval step blocks them from seeing it.
3. Merchant submits a readable permit and subscription proof; Reseller separately verifies identity and submits an initial wallet top-up, both from their own dashboard whenever ready (not required to finish signing up).
4. Admin validates identity, payment destination, amount, and unique reference.
5. Admin approves both required items; the account can then place orders or post products. Products/orders themselves stay blocked at the database level until then, regardless of what the applicant sees on screen.

**Watch out for:** never approve from a screenshot alone — match the actual payment record. Never request an email OTP, Gmail password, bank OTP, or App Password. A rejected renewal must not reject an already-active Merchant.

**Result:** the approved account receives only the access intended for its role; until then it can browse but not transact.

### Reseller Customer Storefront
**Owner:** Reseller + Customer

1. Reseller signs in and browses the protected Merchant Catalog.
2. Reseller opens Product Details and selects **Get for My Product List**.
3. Only explicitly selected products appear in My Product List and the customer storefront.
4. Reseller sets a unique store name, profile photo, cover photo, introduction, and optional contact channels.
5. Reseller previews and shares the readable store-name link.
6. Customer selects **How to Buy** and continues through the published Facebook, phone, Viber, or WhatsApp option.
7. Reseller confirms the product, quantity, final price, delivery, shipping fee, and payment method before recording the committed order.

**Watch out for:** the customer storefront must not expose the main JOM HUB navigation, private address, wallet, or payout details. Never publish an uncontrolled contact account or request OTPs, passwords, banking OTPs, or recovery codes. Remove unavailable products and outdated contact channels promptly.

**Result:** each Reseller has an independent curated storefront and customers receive a clear buying path without system access.

### Staff Account & Permissions
**Owner:** Admin only

1. Create an invitation using the staff member's exact email.
2. Select the minimum required modules.
3. Staff signs in using the invited email.
4. Review access regularly and disable it immediately when no longer required.

**Watch out for:** do not share Admin accounts. Separate Finance, Merchant Review, Reports, and Content access.

**Result:** staff receives least-privilege access with an auditable identity.

### Registration Calendar & Onboarding Schedule
**Owner:** Admin / Onboarding

1. Open Registration Calendar and review new requests.
2. Verify the name, email, phone, interested role, date, and time.
3. Check for duplicate or conflicting schedules.
4. Contact the applicant using the approved business channel.
5. Confirm, reschedule, complete, or cancel the appointment with notes.
6. Use the separate Merchant or Reseller presentation during training.

**Watch out for:** do not expose one applicant's details to another. A scheduled orientation does not replace account and payment approval.

**Result:** each applicant receives a documented schedule and role-specific onboarding.

### Merchant Approval Center
**Owner:** Admin only

1. Open Approval Center and review the Merchant identity.
2. Open Merchant records and verify the permit is readable, valid, and consistent with the profile.
3. Confirm a subscription request exists.
4. Match the payment amount and unique reference with the actual receiving account.
5. Approve the payment and activate only when all checklist items are complete.
6. If information is incomplete, reject the request with a specific corrective note.
7. If the Merchant needs to operate before the permit clears review, open **Merchant Follow-Ups** and approve a temporary access window with an expiry date you set — adjustable later from the same page.
8. A Merchant or Reseller who violates policy can be suspended (Merchants page / Reseller ID Verification page); this immediately blocks new products or orders and can be reversed with **Reinstate**.

**Watch out for:** permit approval alone must not activate the store. Never activate a Merchant with an unverified payment. A follow-up grace period is temporary — it does not replace permit approval.

**Result:** only fully verified Merchant applications receive active store access; temporary or suspended access is always time-bound and reversible.

---

## Revenue

### Merchant Subscription
**Owner:** Admin + Merchant

1. Merchant chooses Starter, Growth, or Pro.
2. Merchant submits payment reference and private proof.
3. Admin confirms receipt and reviews the request once.
4. Approved renewal extends from the later of current expiry or today.
5. Subscription revenue and tax reserve are posted to the platform ledger.

**Watch out for:** reject only the request — not an existing active account. Never approve duplicate references.

**Result:** access is activated or extended and revenue is recorded once.

---

## Catalog

### Admin or Merchant Product Setup
**Owner:** Admin + Merchant

1. Choose the correct Merchant owner when Admin uploads on their behalf.
2. Add a truthful name, description, category, stock, and real product image.
3. Set retail, wholesale, suggested customer price, and any quantity tiers.
4. Keep at least 15% projected gross margin for the Reseller.
5. Add minimum quantity, package measurements, and handling requirements.

**Watch out for:** block illegal, counterfeit, unsafe, regulated, misleading, or otherwise prohibited listings. Wholesale must be below suggested retail. Campaign and quantity prices are verified again by the server.

**Result:** an approved product becomes available with one-piece and bulk profit estimates.

### Categories, Campaigns & Reviews
**Owner:** Admin / Catalog

1. Create clear, non-duplicated product categories.
2. Configure campaign name, discount, start date, end date, and eligibility.
3. Review the discounted outcome before activation.
4. Monitor participating products and stock during the campaign.
5. Review reported ratings or comments using order evidence.
6. Remove only content that violates policy and preserve the reason.

**Watch out for:** do not run overlapping discounts that create invalid prices. Do not remove legitimate negative reviews merely because they are unfavorable.

**Result:** catalog navigation, promotions, and reviews remain accurate and credible.

---

## Orders

### Reseller Customer Order
**Owner:** Reseller

1. Obtain customer authority before recording contact and delivery details.
2. Select one piece or the required bulk quantity and assign the correct customer.
3. Adjust the customer selling price and review the quantity-adjusted buying price.
4. Confirm projected profit after the capped 1% system fee.
5. Checkout requests a fresh server quotation and debits the wallet only when price, stock, access, and balance remain valid.

**Watch out for:** the Reseller fee is 1% of product total, with a ₱3 minimum and ₱50 maximum per order. Do not promise guaranteed earnings; verify address and customer commitment.

**Result:** order, stock deduction, escrow amount, fee, and projected margin are recorded.

### Fulfillment & Completion
**Owner:** Merchant + Reseller

1. Merchant moves Confirmed to Processing and packages the exact items.
2. Merchant submits the actual courier fee for Reseller confirmation.
3. Reseller accepts the fee or declines with a required note explaining why the product will not be taken.
4. Merchant may revise a declined fee; dispatch remains locked until acceptance.
5. After acceptance, Merchant enters courier, tracking, schedule, and dispatch proof before Shipped.
6. Reseller confirms only after checking the received items, or opens a dispute.
7. Without an open case, the order completes seven days after estimated delivery; Merchant net proceeds and the 3% success fee post once.

**Watch out for:** Merchant cannot dispatch before shipping-fee acceptance or confirm its own payout. Shipping is paid to the courier outside wallet escrow. Keep packaging, dispatch, delivery, and communication evidence.

**Result:** delivery cost is agreed before dispatch and escrow is released only after protected completion.

### Shipping Fee Decline & Revision
**Owner:** Merchant + Reseller

1. Reseller selects **Do Not Accept** on the pending fee.
2. Reseller enters a clear note of at least five characters.
3. Merchant reviews the note and decides whether to revise the courier or amount.
4. Merchant submits a revised fee for a new confirmation.
5. If the Reseller still will not take the product, use the recorded cancellation/help process.

**Watch out for:** do not ship after a decline. Do not treat fee acceptance as delivery confirmation.

**Result:** a declined fee remains documented and cannot be bypassed.

### Cancellation, Dispute & Refund
**Owner:** Admin + Parties

1. Buyer or Merchant opens a cancellation, dispute, return, replacement, or refund case with a detailed reason.
2. An open case pauses automatic completion.
3. Merchant may review an early cancellation; Admin resolves escalated or shipped-order cases.
4. Approved cancellation returns the wallet charge, reverses the Reseller fee, and restores stock exactly once.
5. Admin records the resolution; parties retain their evidence and ledger history.

**Watch out for:** never refund outside the ledger without a matching case. Do not resolve a shipped-order dispute without delivery evidence.

**Result:** buyer funds, inventory, platform revenue, and the case record remain reconciled.

---

## Money

### QR Payment, Top-up & Withdrawal Review
**Owner:** Finance Staff/Admin

1. User scans the dynamically generated JOM HUB InstaPay QR for AUBREY NOLASCO.
2. User submits amount, method, one-use reference, and private proof.
3. The system blocks reused references across top-ups and subscriptions.
4. Withdrawals require at least ₱500, observe the ₱100,000 daily limit, and wait 24 hours after payout destination changes.
5. Admin schedules the transfer, uploads transfer proof, and enters a unique reference before marking Sent.

**Watch out for:** spaces, dashes, or capitalization do not make a reused reference valid. Reviewer must verify the owner, amount, destination, reference, and evidence. A rejected withdrawal automatically returns the held amount.

**Result:** wallet and external payment records remain unique and reconcilable.

### Platform Wallet Reconciliation
**Owner:** Admin / Finance

1. Open Platform Wallet and select the reporting date range.
2. Review Reseller fees, completed-order Merchant fees, subscriptions, refunds, and adjustments.
3. Compare top-up approvals and sent withdrawals with the actual bank or e-wallet statement.
4. Investigate duplicate, missing, reversed, or unusually large entries.
5. Export the related reports and preserve reconciliation notes.
6. Resolve discrepancies through the approved transaction or case process.

**Watch out for:** never edit balances directly to force a match. System receipts supplement — but do not replace — official bank records.

**Result:** platform revenue, user wallets, and external accounts can be explained and reconciled.

---

## Admin

### Admin Full-Access Operations
**Owner:** Admin only

1. Create Merchant or Reseller invitations using the exact email and intended role.
2. Add products under the correct Merchant owner.
3. Create Reseller customers and add server-validated items to their Admin cart.
4. Post manual top-ups only after confirming receipt; the system generates a unique ADMIN reference.
5. Review subscriptions, fees, orders, reports, and the Platform Wallet.

**Watch out for:** confirm the owner before every write action. Do not bypass product, stock, pricing, payment, or evidence controls.

**Result:** authorized assistance is completed under Admin identity and remains traceable.

### Recommended Actions & Activity Audit
**Owner:** Admin only

1. Open the Recommended Next Action card on the Admin dashboard.
2. Clear Merchant, subscription, top-up, withdrawal, and registration queues in priority order.
3. Open Activity Audit from the Admin menu.
4. Filter by record type or search the actor, action, and record ID.
5. Compare the old and new status before investigating the related transaction.

**Watch out for:** audit history does not replace external bank reconciliation. Private proofs, passwords, OTPs, and bank credentials are not copied into the audit log.

**Result:** Admin work is prioritized and sensitive operational changes remain traceable.

---

## Daily Operations

### Admin Dashboard Triage
**Owner:** Admin / Operations

1. Open Overview and refresh the dashboard.
2. Follow the Recommended Next Action card first.
3. Review pending Merchant applications and subscription payments.
4. Verify top-ups before withdrawal scheduling.
5. Confirm registration appointments and inspect open Order Cases.
6. End the session by checking Activity Audit and Platform Wallet totals.

**Watch out for:** do not approve requests only to clear the queue. Escalate mismatched amounts, identities, destinations, or references.

**Result:** urgent financial and customer tasks are handled in a consistent risk-based order.

---

## Content

### Homepage & Public Information Update
**Owner:** Admin / Content

1. Open Homepage and review the current announcement, hero, banners, and enabled sections.
2. Compare public claims with current fees, subscription plans, login method, and workflows.
3. Update only safe internal links and approved HTTPS images.
4. Preview desktop and mobile layouts.
5. Save, then verify the public production page.
6. Update Process Guide, presentations, and JOM Bits whenever a workflow changes.

**Watch out for:** do not publish guaranteed income, unsupported safety claims, or outdated prices. Keep payment destination and support details consistent across pages.

**Result:** the public website and internal guidance describe the same live system.

---

## User Experience

### Reseller & Merchant Usability Check
**Owner:** Admin / Operations

1. Sign in with a Reseller test account and verify the five-step setup checklist and Recommended Next Action.
2. Use the mobile bottom bar to open Products, Orders, Wallet, and Account.
3. Open an order and verify the visual status timeline and responsible party.
4. Open notifications and confirm an item remains unread until selected.
5. Ask JOM Bits a question on Products, Orders, and Wallet and verify the suggested questions change.
6. Repeat the same checks with a Merchant test account.

**Watch out for:** test at 320px phone width and at least one desktop viewport. Do not use real customer payment data in usability testing.

**Result:** both roles can find their next task and complete core workflows on any supported device.

---

## Security

### Incident, Error & Recovery Procedure
**Owner:** Admin + Technical Support

1. Record the exact error, user role, page, reference, and time.
2. Pause the affected approval or transaction instead of retrying repeatedly.
3. Check Activity Audit, Login History, related reports, and Supabase logs.
4. Preserve screenshots and transaction evidence without collecting secrets.
5. Apply and test the smallest controlled correction.
6. Reconcile financial impact, notify affected users, and document closure.

**Watch out for:** never run reset, cleanup, or destructive SQL as a first response. Do not mark an incident resolved until balances, stock, status, and evidence agree.

**Result:** incidents are contained, investigated, corrected, and documented safely.

### Daily Launch & Security Check
**Owner:** Admin

1. Check pending Merchant, top-up, withdrawal, and subscription reviews.
2. Review failed logins, unusual orders, duplicate references, and staff access.
3. Reconcile wallet totals, fee ledger, refunds, and external accounts.
4. Review Supabase usage, backups, spend cap, SMTP, and storage.
5. Test one complete order after every financial migration.

**Watch out for:** never run destructive reset or cleanup SQL in production. Never place the service-role key in frontend environment variables.

**Result:** problems are detected before they become financial or customer incidents.

---

## Compliance

### Policy Publishing
**Owner:** Admin only

1. Create a new Draft version.
2. Review legal text, dates, fees, and contact details.
3. Preview on mobile and desktop.
4. Publish; the previous version archives automatically.
5. Export and retain the approved HTML/PDF copy.

**Watch out for:** never directly rewrite historical published terms. Obtain legal/accounting review for material financial changes.

**Result:** public footer loads the latest effective published policy.

---

## Communication

### Chat History & Customer Support
**Owner:** Admin / Support

1. Open Chat History and locate the Merchant–Reseller thread.
2. Confirm the participants and related order before interpreting messages.
3. Use timestamps and transaction records to establish sequence.
4. Direct the parties to Order Cases for cancellation, dispute, return, replacement, or refund.
5. Record the operational resolution in the proper module, not only in chat.

**Watch out for:** access chat only for an authorized support, safety, or dispute purpose. Never ask users to send OTPs, passwords, or bank credentials in chat.

**Result:** support decisions are based on complete context and recorded in the correct workflow.

---

## Reports

### Reports, Export & Receipt Procedure
**Owner:** Admin / Finance / Operations

1. Choose Sales, Inventory, Top-Up, Withdrawal, or Ordered Report.
2. Select Today, Last 7 Days, Last 30 Days, This Month, Last Month, This Quarter, This Year, or Custom dates.
3. Select Apply Period and confirm the loaded period and record count.
4. Review summary totals before downloading; Excel remains disabled if dates were changed but not applied.
5. Download the Excel file, which includes the reporting period, scope, generation time, and record count.
6. Treat Admin and Merchant Inventory as a current snapshot; historical stock requires future inventory-ledger data.
7. For individual orders, top-ups, or withdrawals, use Print Receipt from the owner's record.
8. Store exported files according to the business retention policy.

**Watch out for:** confirm role, status, and loaded period before sharing a report. Do not treat projected Reseller margin as realized income.

**Result:** teams receive consistent reports and transaction records with clear scope.
