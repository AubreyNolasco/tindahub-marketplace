import { useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, ChevronRight, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const sharedReports = ['Set the date or available filters.', 'Review the summary and detailed records.', 'Export the report when you need an offline copy.', 'Compare totals with Wallet and order records before making financial decisions.']
const guides = {
  reseller: [
    ['/reseller/orders', 'Orders walkthrough', ['Open an order to check its current status.', 'Verify the customer, items, quantity, and delivery information.', 'Track Confirmed → Processing → Shipped.', 'Confirm delivery only after the correct items are actually received.']],
    ['/reseller/customers', 'Customers walkthrough', ['Ask permission before recording customer information.', 'Add the correct name, phone, and complete address.', 'Review saved details before assigning the customer to an order.', 'Update incorrect information before checkout.']],
    ['/reseller/wallet', 'Wallet walkthrough', ['Check your available balance and transaction history.', 'Select Top Up when more buying funds are needed.', 'Pay using the displayed JOM HUB QR and upload proof with a one-use reference.', 'Wait for Admin approval before using pending funds.']],
    ['/reseller/chats', 'Messages walkthrough', ['Open the conversation for the correct Merchant.', 'Keep messages focused on the recorded product and order.', 'Do not share passwords, OTPs, or unnecessary customer information.', 'Keep important fulfillment and dispute evidence in the thread.']],
    ['/reseller/address', 'Address walkthrough', ['Enter your complete unit, street, barangay, city, province, and postal code.', 'Add an accurate landmark when helpful for delivery.', 'Review spelling and phone details.', 'Save before creating customers or placing orders.']],
    ['/reseller/reports', 'Reports walkthrough', sharedReports],
    ['/reseller', 'Reseller overview walkthrough', ['Check wallet, orders, and quick business totals.', 'Browse approved products and choose one-piece or bulk quantity.', 'Adjust the customer price and review estimated profit after the capped system fee.', 'Add a customer, place the verified order, and track it until completion.']]
  ],
  merchant: [
    ['/merchant/products', 'Products walkthrough', ['Select Add Product to create a listing.', 'Upload a real image and enter truthful, allowed product information.', 'Set retail, wholesale, suggested customer price, stock, and quantity tiers.', 'Check the Reseller margin and package details before publishing.']],
    ['/merchant/orders', 'Orders walkthrough', ['Open each Confirmed order and verify items and stock.', 'Move the order to Processing only after accepting it.', 'Pack correctly and move Processing → Shipped after dispatch.', 'Wait for the Reseller to confirm receipt; net payout follows completion.']],
    ['/merchant/wallet', 'Wallet walkthrough', ['Review available balance and completed-order payouts.', 'Check every fee, top-up, and withdrawal ledger entry.', 'Use Top Up or Withdrawal and provide accurate payment details.', 'Wait for Admin review and retain your external transaction proof.']],
    ['/merchant/campaigns', 'Campaign walkthrough', ['Review the discount, start date, and end date.', 'Check that discounted pricing remains sustainable.', 'Join only with enough inventory and fulfillment capacity.', 'Monitor campaign orders and server-verified prices.']],
    ['/merchant/purchases', 'Merchant purchases walkthrough', ['Review products and quantities before checkout.', 'Confirm the delivery address and server-verified total.', 'Track the order through shipment.', 'Confirm completion only after receiving the correct items.']],
    ['/merchant/reviews', 'Reviews walkthrough', ['Read verified customer feedback and its related product.', 'Respond professionally without exposing private information.', 'Use recurring feedback to improve listings and fulfillment.', 'Report suspicious or abusive content to Admin.']],
    ['/merchant/chats', 'Messages walkthrough', ['Open the correct Reseller conversation.', 'Keep product, stock, and fulfillment details accurate.', 'Never request OTPs, passwords, or off-ledger payments.', 'Preserve order and dispute evidence in the thread.']],
    ['/merchant/address', 'Pickup address walkthrough', ['Enter the complete business pickup address.', 'Add accurate contact and landmark information.', 'Confirm the location can be used by the delivery provider.', 'Save changes before accepting new orders.']],
    ['/merchant/reports', 'Reports walkthrough', sharedReports],
    ['/merchant', 'Merchant overview walkthrough', ['Check new orders, inventory, wallet, and subscription status.', 'Keep the business permit, pickup address, and subscription current.', 'Add safe products with viable Reseller pricing.', 'Process orders in sequence and review net proceeds after the 3% completed-order fee.']]
  ],
  admin: [
    ['/admin/full-access', 'Full Access walkthrough', ['Choose the exact Merchant or Reseller account you will assist.', 'Use the correct action for invitations, manual top-ups, customers, carts, or role creation.', 'Verify owner, amount, stock, and supporting evidence before saving.', 'Confirm the result in its source module and preserve the Admin audit trail.']],
    ['/admin/staff', 'Staff Access walkthrough', ['Invite staff using their exact email address.', 'Grant only the modules required for their work.', 'Review permissions before activation.', 'Disable access immediately when it is no longer needed.']],
    ['/admin/products', 'Admin Products walkthrough', ['Choose the correct Merchant owner.', 'Upload a real image and enter truthful, allowed product details.', 'Set stock, prices, minimum quantity, quantity tiers, and package data.', 'Confirm Reseller margin and safety requirements before publishing.']],
    ['/admin/merchants', 'Merchant review walkthrough', ['Open each pending Merchant profile.', 'Verify identity, business details, address, and permit.', 'Cross-check subscription payment and unique reference.', 'Approve or reject with a clear recorded reason.']],
    ['/admin/registrations', 'Onboarding Calendar walkthrough', ['Open each pending training schedule.', 'Review the applicant role, contact details, preferred date, and time.', 'Contact the applicant and reschedule only when agreed.', 'Update the status to Contacted, Confirmed, or Cancelled.']],
    ['/admin/subscriptions', 'Subscriptions walkthrough', ['Open each pending subscription payment request.', 'Match amount, plan, account name, proof, and one-use reference with the actual payment.', 'Approve or reject the request exactly once.', 'Confirm the subscription dates and platform revenue entry after approval.']],
    ['/admin/topups', 'Top-Ups walkthrough', ['Open each pending top-up request.', 'Match amount, account, InstaPay destination, proof, and unique reference.', 'Approve only after confirming the actual external payment.', 'Verify that the wallet is credited once and the ledger entry is complete.']],
    ['/admin/withdrawals', 'Withdrawals walkthrough', ['Review the owner, amount, wallet hold, and payout details.', 'Confirm the external payout destination before sending.', 'Approve or reject the request exactly once.', 'Retain payout evidence and verify the wallet ledger result.']],
    ['/admin/wallet', 'Platform Wallet walkthrough', ['Review total platform balance and recent revenue entries.', 'Separate Reseller service fees, Merchant success fees, and subscriptions.', 'Check reversals and recorded tax reserves.', 'Reconcile totals with orders, requests, and external payment records.']],
    ['/admin/payments', 'Payments walkthrough', ['Filter or open the payment needing review.', 'Match its order, Merchant, method, amount, and proof.', 'Investigate missing or inconsistent records before changing status.', 'Keep sensitive payment evidence private.']],
    ['/admin/sales', 'Sales walkthrough', ['Review marketplace sales and fee totals.', 'Check order statuses and excluded cancellations.', 'Compare product totals with Reseller and Merchant fees.', 'Use reports and Wallet entries to investigate differences.']],
    ['/admin/reports', 'Admin Reports walkthrough', sharedReports],
    ['/admin/campaigns', 'Campaigns walkthrough', ['Create a clear campaign name, discount, and valid dates.', 'Confirm the discount remains reasonable for participating products.', 'Publish only complete and truthful campaign details.', 'Monitor activation, participation, and resulting orders.']],
    ['/admin/categories', 'Categories walkthrough', ['Review existing categories before creating another.', 'Use a clear customer-facing name and description.', 'Avoid duplicates or overly broad categories.', 'Confirm affected products remain correctly organized.']],
    ['/admin/homepage', 'Homepage Editor walkthrough', ['Choose the section or banner you need to update.', 'Enter accurate public text, link, colors, and media.', 'Preview the result on mobile and desktop.', 'Save and verify the live homepage after publishing.']],
    ['/admin/chats', 'Chat History walkthrough', ['Locate the correct conversation and participants.', 'Review only when support, safety, or dispute work requires it.', 'Preserve relevant evidence without exposing unrelated private data.', 'Record the authorized follow-up action.']],
    ['/admin/login-history', 'Login History walkthrough', ['Review recent successful and failed account activity.', 'Check unusual timing, account, device, or location patterns.', 'Contact the account owner when verification is required.', 'Restrict access and preserve evidence when risk is confirmed.']],
    ['/admin/reviews', 'Reviews walkthrough', ['Open the review and related product or order.', 'Check whether it is verified, relevant, and policy-compliant.', 'Preserve legitimate feedback even when negative.', 'Remove or escalate only abusive, fraudulent, or prohibited content.']],
    ['/admin/legal', 'Legal Settings walkthrough', ['Create a draft instead of overwriting historical published text.', 'Review effective date, fees, contacts, and complete policy wording.', 'Preview the public page on mobile and desktop.', 'Publish only after authorized legal and operational review.']],
    ['/admin/process-guide', 'Admin Process Guide walkthrough', ['Choose the operation you need to perform.', 'Read every step and important control before acting.', 'Complete the work in the linked Admin module.', 'Confirm the expected result and retain required evidence.']],
    ['/admin', 'Admin overview walkthrough', ['Review the pending-action totals and latest notifications.', 'Prioritize subscriptions, top-ups, withdrawals, Merchant reviews, and onboarding schedules.', 'Reconcile Platform Wallet, fees, refunds, and external payments.', 'Review security activity and complete the daily operational checklist.']]
  ]
}

export default function PageWalkthroughGuide() {
  const { role } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [targetLabel, setTargetLabel] = useState('Current page')
  const guide = useMemo(() => (guides[role] || []).find(([path]) => path === `/${role}` ? pathname === path : pathname.startsWith(path)) || [pathname, 'Page walkthrough', ['Review the information shown on this page.', 'Use the primary action to continue.', 'Confirm all details before saving or submitting.', 'Return to the workspace menu when finished.']], [pathname, role])
  const [, title, steps] = guide
  const start = () => { setStep(0); setOpen(true) }

  useEffect(() => {
    if (!open) return
    const instruction = steps[step] || ''
    const keywords = instruction.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length >= 4 && !['before','after','every','correct','review','confirm','check','current','complete'].includes(word))
    const candidates = [...document.querySelectorAll('[data-guide-current-nav], main button, main a, main input, main select, main textarea, main h1, main h2, main section, main .card, [data-guide-notifications]')]
      .filter(element => element.offsetParent !== null && !element.closest('[data-guide-walkthrough]'))
    const score = element => {
      const text = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('placeholder') || ''} ${element.getAttribute('title') || ''}`.toLowerCase()
      return keywords.reduce((total, word) => total + (text.includes(word) ? 3 : 0), 0) + (element.matches('.btn-primary') ? 1 : 0)
    }
    let target
    if (step === 0) target = candidates.find(element => element.matches('[data-guide-current-nav]')) || candidates.find(element => element.matches('main h1'))
    if (!target) target = candidates.sort((a,b) => score(b)-score(a))[0]
    if (!target || score(target) === 0) target = step === steps.length - 1 ? candidates.find(element => element.matches('main .btn-primary, main button')) : candidates.find(element => element.matches('main h1, main h2, main section'))
    if (!target) return
    const previous = { outline:target.style.outline, outlineOffset:target.style.outlineOffset, boxShadow:target.style.boxShadow, position:target.style.position, zIndex:target.style.zIndex, borderRadius:target.style.borderRadius }
    target.style.outline = '4px solid #F2A93B'
    target.style.outlineOffset = '5px'
    target.style.boxShadow = '0 0 0 10px rgba(242,169,59,.18), 0 18px 45px rgba(4,59,37,.22)'
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
    target.style.zIndex = '75'
    target.style.borderRadius = target.style.borderRadius || '12px'
    target.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' })
    const label = target.getAttribute('aria-label') || target.getAttribute('placeholder') || target.textContent?.trim().replace(/\s+/g,' ').slice(0,70) || target.tagName.toLowerCase()
    setTargetLabel(label)
    return () => Object.assign(target.style, previous)
  }, [open, step, pathname, steps])

  return <>
    <button type="button" onClick={start} className="flex h-10 items-center gap-2 rounded-xl border border-black/[.06] bg-white px-3 text-sm font-bold text-teal-700 shadow-sm transition hover:bg-teal-50" aria-label="Open page walkthrough"><BookOpenCheck size={18}/><span className="hidden sm:inline">Guide</span></button>
    {open && <div data-guide-walkthrough className="fixed inset-x-3 bottom-3 z-[95] mx-auto w-auto max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl sm:bottom-5 sm:right-5 sm:mx-0 sm:w-[27rem]" role="dialog" aria-labelledby="walkthrough-title"><header className="relative bg-gradient-to-br from-teal-950 to-teal-700 px-5 py-4 text-white"><button onClick={()=>setOpen(false)} className="absolute right-3 top-3 rounded-xl bg-white/10 p-2 hover:bg-white/20" aria-label="Close guide"><X size={18}/></button><p className="text-[10px] font-bold uppercase tracking-[.16em] text-mango-300">Interactive guide · Step {step+1} of {steps.length}</p><h2 id="walkthrough-title" className="mt-1 pr-10 font-display text-lg font-bold">{title}</h2></header><div className="p-4"><div className="mb-3 flex gap-1.5">{steps.map((_,index)=><span key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-teal-600' : 'bg-black/10'}`}/>)}</div><div className="flex gap-3 rounded-2xl bg-cream p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">{step+1}</span><div><p className="text-sm leading-6 text-ink/70">{steps[step]}</p><p className="mt-2 text-[11px] font-bold text-mango-700">Highlighted: {targetLabel}</p><p className="mt-0.5 text-[10px] text-ink/45">Click the highlighted control when needed, or press Next.</p></div></div><div className="mt-4 flex gap-2">{step > 0 && <button onClick={()=>setStep(value=>value-1)} className="btn-secondary flex-1 py-2">Back</button>}<button onClick={()=>step === steps.length-1 ? setOpen(false) : setStep(value=>value+1)} className="btn-primary flex flex-1 items-center justify-center gap-2 py-2">{step === steps.length-1 ? 'Finish' : 'Next'}{step < steps.length-1 && <ChevronRight size={16}/>}</button></div></div></div>}
  </>
}
