import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { peso } from '../../utils/format'

export default function ShippingDecisionModal({ order, open, onClose, onSaved }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState('')
  if (!open || !order) return null
  const respond = async (accept) => {
    if (!accept && note.trim().length < 5) return toast.error('Explain why you will not accept the order (at least 5 characters).')
    setSaving(accept ? 'accept' : 'decline')
    const { error } = await supabase.rpc('respond_order_shipping_fee', { p_order_id: order.id, p_accept: accept, p_note: note || null })
    setSaving('')
    if (error) return toast.error(error.message === 'DECLINE_NOTE_REQUIRED' ? 'A decline note is required.' : error.message)
    toast.success(accept ? 'Shipping fee accepted. The Merchant can now dispatch the order.' : 'Order pickup declined. Your note was sent to the Merchant.')
    setNote(''); onSaved?.(); onClose()
  }
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/60 p-4"><div className="card w-full max-w-md p-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Review shipping fee</h2><p className="mt-1 text-sm text-ink/55">Merchant submitted <strong className="text-ink">{peso(order.proposed_shipping_fee)}</strong>.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
    {order.shipping_fee_merchant_note && <p className="mt-4 rounded-xl bg-teal-50 p-3 text-xs leading-5 text-teal-900"><strong>Merchant note:</strong> {order.shipping_fee_merchant_note}</p>}
    <label className="mt-4 block text-sm font-semibold">Note <span className="font-normal text-ink/45">(required when declining)</span><textarea rows="3" maxLength="500" value={note} onChange={(event)=>setNote(event.target.value)} className="input-field mt-1 resize-none" placeholder="Reason or confirmation note" /></label>
    <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" disabled={Boolean(saving)} onClick={()=>respond(true)} className="btn-primary flex justify-center gap-2">{saving==='accept'?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/>}Accept fee</button><button type="button" disabled={Boolean(saving)} onClick={()=>respond(false)} className="flex items-center justify-center gap-2 rounded-xl bg-coral-100 px-4 py-2.5 font-semibold text-coral-700">{saving==='decline'?<Loader2 size={16} className="animate-spin"/>:<X size={16}/>}Do not accept</button></div>
  </div></div>
}
