import { useEffect, useState } from 'react'
import { Loader2, PackageCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { peso } from '../../utils/format'

export default function ShippingFeeModal({ order, open, onClose, onSaved }) {
  const [fee, setFee] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    setFee(order?.proposed_shipping_fee ?? '')
    setNote(order?.shipping_fee_merchant_note || '')
  }, [open, order])
  if (!open || !order) return null
  const submit = async (event) => {
    event.preventDefault()
    if (fee === '' || Number(fee) < 0) return toast.error('Enter the actual shipping fee.')
    setSaving(true)
    const { error } = await supabase.rpc('propose_order_shipping_fee', { p_order_id: order.id, p_fee: Number(fee), p_note: note || null })
    setSaving(false)
    if (error) return toast.error(error.message === 'VALID_SHIPPING_FEE_REQUIRED' ? 'Enter a valid shipping fee.' : error.message)
    toast.success(`Shipping fee ${peso(fee)} sent to the Reseller for confirmation.`)
    onSaved?.(); onClose()
  }
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/60 p-4"><form onSubmit={submit} className="card w-full max-w-md p-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Confirm packaging fee</h2><p className="mt-1 text-xs leading-5 text-ink/50">Enter the courier fee after the order is packaged. Dispatch stays locked until the Reseller accepts.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
    {order.shipping_fee_confirmation_status === 'declined' && <div className="mt-4 rounded-xl bg-coral-50 p-3 text-xs text-coral-800"><strong>Reseller declined:</strong> {order.shipping_fee_reseller_note}</div>}
    <label className="mt-5 block text-sm font-semibold">Actual shipping fee<input required type="number" min="0" step=".01" value={fee} onChange={(event)=>setFee(event.target.value)} className="input-field mt-1" placeholder="0.00" /></label>
    <label className="mt-4 block text-sm font-semibold">Merchant note (optional)<textarea rows="3" maxLength="500" value={note} onChange={(event)=>setNote(event.target.value)} className="input-field mt-1 resize-none" placeholder="Courier, package size, or fee details" /></label>
    <button disabled={saving} className="btn-primary mt-5 flex w-full justify-center gap-2">{saving ? <Loader2 size={16} className="animate-spin"/> : <PackageCheck size={16}/>}Send for Reseller confirmation</button>
  </form></div>
}
