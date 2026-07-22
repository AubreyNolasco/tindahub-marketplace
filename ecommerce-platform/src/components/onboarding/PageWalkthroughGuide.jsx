import { useMemo, useState } from 'react'
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
  ]
}

export default function PageWalkthroughGuide() {
  const { role } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const guide = useMemo(() => (guides[role] || []).find(([path]) => path === `/${role}` ? pathname === path : pathname.startsWith(path)) || [pathname, 'Page walkthrough', ['Review the information shown on this page.', 'Use the primary action to continue.', 'Confirm all details before saving or submitting.', 'Return to the workspace menu when finished.']], [pathname, role])
  const [, title, steps] = guide
  const start = () => { setStep(0); setOpen(true) }
  return <>
    <button type="button" onClick={start} className="flex h-10 items-center gap-2 rounded-xl border border-black/[.06] bg-white px-3 text-sm font-bold text-teal-700 shadow-sm transition hover:bg-teal-50" aria-label="Open page walkthrough"><BookOpenCheck size={18}/><span className="hidden sm:inline">Guide</span></button>
    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="walkthrough-title"><div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="relative bg-gradient-to-br from-teal-950 to-teal-700 p-6 text-white"><button onClick={()=>setOpen(false)} className="absolute right-4 top-4 rounded-xl bg-white/10 p-2 hover:bg-white/20" aria-label="Close guide"><X size={18}/></button><BookOpenCheck className="text-mango-300"/><p className="mt-4 text-xs font-bold uppercase tracking-[.16em] text-mango-300">Step {step+1} of {steps.length}</p><h2 id="walkthrough-title" className="mt-1 pr-10 font-display text-2xl font-bold">{title}</h2></header><div className="p-6"><div className="mb-5 flex gap-1.5">{steps.map((_,index)=><span key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-teal-600' : 'bg-black/10'}`}/>)}</div><div className="flex gap-4 rounded-2xl bg-cream p-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-600 text-sm font-bold text-white">{step+1}</span><p className="text-sm leading-7 text-ink/70">{steps[step]}</p></div><div className="mt-6 flex gap-3">{step > 0 && <button onClick={()=>setStep(value=>value-1)} className="btn-secondary flex-1">Back</button>}<button onClick={()=>step === steps.length-1 ? setOpen(false) : setStep(value=>value+1)} className="btn-primary flex flex-1 items-center justify-center gap-2">{step === steps.length-1 ? 'Finish' : 'Next'}{step < steps.length-1 && <ChevronRight size={16}/>}</button></div></div></div></div>}
  </>
}
