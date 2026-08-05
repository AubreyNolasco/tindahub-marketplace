// Server-side mirror of src/config/jomBitsKnowledge.js's title/answer
// pairs, formatted as plain text to ground the AI adapter. This is a
// deliberate duplication, not a shared import — Vite (frontend) and
// Deno (edge functions) don't share a module graph in this project, and
// the two are used differently anyway: the frontend list drives the
// always-on keyword matcher, this text just tells the model what it's
// allowed to talk about. KEEP IN SYNC with jomBitsKnowledge.js whenever
// JOM HUB's processes change — this going stale means the AI answers
// with outdated policy, same risk as the keyword matcher going stale.

const SHARED = `
- Create a JOM HUB account: Select Register now, verify your Gmail with the 6-digit OTP, choose Reseller or Merchant, and complete the required account details.
- Schedule registration or training: Open the registration calendar, pick an available date and time, enter contact details, and submit for Admin confirmation.
- Account security: Keep your email OTP, password, bank OTP, and payment codes private. Use a unique payment reference for every request and keep all order/payment evidence inside JOM HUB.
- Account address: Open Update Account or the Address page and save a complete address. A complete address is required before protected ordering and fulfillment actions are available.
- Order cases (cancellation/dispute/return/refund): Open the affected order, select Request Cancellation / Help, choose the case type, explain the issue, and attach evidence when required. An open case pauses automatic completion while reviewed.
- Notifications: Use the bell in the workspace header to review account-specific order, wallet, subscription, and case updates.
- Page guide: Select the guide icon beside the notification bell for a step-by-step walkthrough of the current page.
- Setup checklist / Next Action: The dashboard shows a five-step setup checklist and Recommended Next Action card, each linking to where you finish it.
- Printable receipts: Open the related order or Wallet request and select Print receipt. Always compare against the official external payment record.
`.trim()

const RESELLER = `
- Reseller activation: Complete your profile and address to enter your dashboard right away. Placing orders and adding customers stays locked until Admin approves your ID verification and an initial wallet top-up.
- Customers: Open Customers, add the customer with permission, verify name/phone/complete delivery address before assigning products.
- Products and buying price: Browse the Catalog. Your Reseller buying price and available quantity are shown before adding to cart.
- Reseller customer store: Select "Get for My Product List" on a product, then set up your store name/photos/intro/optional channels in My Product List. Only selected products appear on your unique customer link.
- Reseller earnings: Set your customer selling price. Estimated profit is customer total minus your buying subtotal and the capped 1% system fee (minimum ₱3, maximum ₱50), before delivery/marketing/returns/taxes.
- Place an order: Assign a saved customer, review quantity/selling price, wait for secure server price verification, confirm checkout. The wallet pays product subtotal + Reseller system fee; shipping is separate.
- Track delivery: Review the Merchant's actual shipping fee in Orders. Accept to allow dispatch, or decline with a required note. Confirm Delivery only after items are actually received and checked.
- Reseller wallet: Submit a top-up with a unique reference and proof, review the ledger, or request a withdrawal. Funds become usable only after Admin approval.
- Withdraw funds: Save the correct payout account, wait 24 hours after changing it, then request at least ₱500 (daily limit ₱100,000). Admin schedules and records the transfer.
- Reseller reports: Choose a duration or custom dates, Apply Period, review totals, download Excel. Customer income is realized only after recording the customer payment as Paid.
`.trim()

const MERCHANT = `
- Merchant activation: Complete your business profile and pickup address to enter your dashboard right away. Signup grants a free 6-month subscription automatically. Posting products stays locked until Admin approves your business permit.
- Merchant subscription: Free 6-month subscription at signup. Once expired, the whole dashboard locks until renewed (or Admin manually extends/grants one).
- Product listing: Truthful details, real image, stock, retail and wholesale prices, packed measurements, handling needs. Prohibited/illegal/counterfeit/unsafe/misleading products cannot be posted.
- Merchant proceeds: Completed product subtotal less the 3% completed-order platform fee. Real profit also subtracts product cost, packaging, fulfillment, returns, and taxes.
- Process an order: Move an accepted order to Processing, package the exact items, submit the actual shipping fee. Dispatch stays locked until the Reseller accepts.
- Dispatch an order: Before marking Shipped, enter courier, tracking number, pickup time, delivery estimate, actual fee, and dispatch proof. Payout releases only after protected completion.
- Merchant wallet: Review completed-order payouts, top-ups, withdrawals, and ledger entries. Reconcile against Sales and Ordered reports.
- Withdraw funds: Save the correct payout account, wait 24 hours after changing it, then request at least ₱500 (daily limit ₱100,000). Admin schedules and records proof.
- Store availability: Set optional opening/closing hours in Update Account. With automatic store hours enabled, products become unavailable outside the schedule.
- Merchant reports: Choose a duration or custom dates, Apply Period, review totals, download Excel. Sales/orders/top-ups/withdrawals use that period; Inventory is a live stock snapshot.
`.trim()

export function getKnowledgeScope(role: string): string {
  const roleBlock = role === 'merchant' ? MERCHANT : RESELLER
  return `${roleBlock}\n\n${SHARED}`
}
