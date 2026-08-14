import { useEffect, useState } from 'react'
import { Loader2, PackageCheck, Truck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { peso } from '../../utils/format'

const PROVIDER_LABELS = { lalamove: 'Lalamove', grabexpress: 'GrabExpress', borzo: 'Borzo', ninjavan: 'Ninja Van', jnt: 'J&T Express', manual: 'Manual' }
const SERVICE_TYPES = [{ value: 'MOTORCYCLE', label: 'Motorcycle' }, { value: 'CAR', label: 'Car' }]

export default function ShippingFeeModal({ order, open, onClose, onSaved }) {
  const [fee, setFee] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [quotationId, setQuotationId] = useState(null)
  const [accountId, setAccountId] = useState(null)
  const [serviceType, setServiceType] = useState('MOTORCYCLE')
  useEffect(() => {
    if (!open) return
    setFee(order?.proposed_shipping_fee ?? '')
    setNote(order?.shipping_fee_merchant_note || '')
    setQuotationId(null)
    setAccountId(null)
    setServiceType('MOTORCYCLE')
  }, [open, order])
  if (!open || !order) return null

  // Auto-book only fires if the accepted fee carries a delivery account id
  // through (see propose_order_shipping_fee / trg_notify_lalamove_dispatch_ready),
  // so manually editing the fee after quoting clears it deliberately.
  const getQuote = async () => {
    setQuoting(true)
    const { data, error } = await supabase.functions.invoke('delivery-quote', { body: { order_id: order.id, service_type: serviceType } })
    setQuoting(false)
    if (error || data?.error) {
      const message = data?.error || error?.message || 'Could not get a delivery quote.'
      return toast.error(message === 'LALAMOVE_NOT_CONNECTED' || message === 'DELIVERY_NOT_AVAILABLE' ? 'No delivery provider is connected yet — enter the fee manually.' : message === 'MERCHANT_PICKUP_LOCATION_MISSING' ? 'Set your pickup location before getting a quote.' : message === 'CUSTOMER_LOCATION_MISSING' ? "This customer doesn't have a pinned location yet." : message)
    }
    setFee(data.price)
    setQuotationId(data.quotation_id)
    setAccountId(data.account_id)
    toast.success(`${PROVIDER_LABELS[data.provider_code] || data.provider_code} quote: ${peso(data.price)}`)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (fee === '' || Number(fee) < 0) return toast.error('Enter the actual shipping fee.')
    setSaving(true)
    const { error } = await supabase.rpc('propose_order_shipping_fee', { p_order_id: order.id, p_fee: Number(fee), p_note: note || null, p_lalamove_quotation_id: quotationId, p_delivery_quote_account_id: accountId, p_delivery_service_type: accountId ? serviceType : null })
    setSaving(false)
    if (error) return toast.error(error.message === 'VALID_SHIPPING_FEE_REQUIRED' ? 'Enter a valid shipping fee.' : error.message)
    toast.success(accountId ? `Delivery quote ${peso(fee)} sent to the Reseller — booking is automatic once they accept.` : `Shipping fee ${peso(fee)} sent to the Reseller for confirmation.`)
    onSaved?.(); onClose()
  }
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-scrim/60 p-4"><form onSubmit={submit} className="card w-full max-w-md p-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Confirm packaging fee</h2><p className="mt-1 text-xs leading-5 text-ink/50">Enter the courier fee after the order is packaged. Dispatch stays locked until the Reseller accepts.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
    {order.shipping_fee_confirmation_status === 'declined' && <div className="mt-4 rounded-xl bg-coral-100 p-3 text-xs text-coral-700"><strong>Reseller declined:</strong> {order.shipping_fee_reseller_note}</div>}
    <div className="mt-5">
      <label className="block text-sm font-semibold">Vehicle needed
        <select value={serviceType} onChange={(event) => { setServiceType(event.target.value); setQuotationId(null); setAccountId(null) }} className="input-field mt-1">
          {SERVICE_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button type="button" disabled={quoting} onClick={getQuote} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 py-2.5 text-sm font-semibold text-teal-700 disabled:opacity-60">
        {quoting ? <Loader2 size={16} className="animate-spin"/> : <Truck size={16}/>}Get delivery quote
      </button>
    </div>
    <label className="mt-4 block text-sm font-semibold">Actual shipping fee<input required type="number" min="0" step=".01" value={fee} onChange={(event)=>{setFee(event.target.value); setQuotationId(null); setAccountId(null)}} className="input-field mt-1" placeholder="0.00" /></label>
    {accountId && <p className="mt-1.5 text-xs font-medium text-teal-700">Delivery quote applied — booking will be automatic once the Reseller accepts.</p>}
    <label className="mt-4 block text-sm font-semibold">Merchant note (optional)<textarea rows="3" maxLength="500" value={note} onChange={(event)=>setNote(event.target.value)} className="input-field mt-1 resize-none" placeholder="Courier, package size, or fee details" /></label>
    <button disabled={saving} className="btn-primary mt-5 flex w-full justify-center gap-2">{saving ? <Loader2 size={16} className="animate-spin"/> : <PackageCheck size={16}/>}Send for Reseller confirmation</button>
  </form></div>
}
