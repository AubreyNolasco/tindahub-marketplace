import { useEffect, useState } from 'react'
import { Loader2, Truck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'
import { compressImage } from '../../utils/security'

const ACTIVE_LALAMOVE_STATUSES = ['booking', 'booked', 'assigning_driver', 'on_going', 'picked_up']

export default function DeliveryModal({order,open,onClose,onSaved}){
  const{user}=useAuth()
  const[provider,setProvider]=useState(''),[tracking,setTracking]=useState(''),[pickup,setPickup]=useState(''),[eta,setEta]=useState(''),[proof,setProof]=useState(null),[saving,setSaving]=useState(false)
  const [booking, setBooking] = useState(null)
  const [checkingBooking, setCheckingBooking] = useState(true)

  // Reseller accepting a fee that came from an automatic quote triggers
  // booking in the background (trg_notify_lalamove_dispatch_ready ->
  // delivery-book edge function, via whichever tier's account produced
  // the quote). While that's in flight the order can briefly still be
  // 'processing' — check for an active booking so the merchant doesn't
  // accidentally submit a conflicting manual dispatch.
  useEffect(() => {
    if (!open || !order) return
    setCheckingBooking(true)
    supabase.from('lalamove_bookings').select('status, lalamove_order_id, failure_reason').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { setBooking(data || null); setCheckingBooking(false) })
  }, [open, order])

  if(!open||!order)return null

  const bookingActive = booking && ACTIVE_LALAMOVE_STATUSES.includes(booking.status)
  const bookingFailed = booking && booking.status === 'failed'
  const isPrepaid = order.shipping_payment_method === 'prepaid_wallet'
  const confirmedFee = order.proposed_shipping_fee ?? order.shipping_fee

  const submit=async e=>{
    e.preventDefault()
    // order.dispatch_ready is a single generated column mirroring the exact
    // condition set_order_delivery()'s own WHERE clause enforces server-side
    // (prepaid OR fee accepted) — checking it here instead of re-deriving the
    // same boolean means this pre-check can't drift from what the RPC
    // actually allows.
    if(!order.dispatch_ready)return toast.error('Reseller shipping confirmation is required.')
    if(!proof)return toast.error('Upload dispatch or booking proof.')
    setSaving(true)
    const compressed=await compressImage(proof)
    const ext=compressed.name.split('.').pop()?.toLowerCase()||'jpg',path=`${user.id}/${order.id}/${Date.now()}.${ext}`
    const upload=await supabase.storage.from('delivery-proofs').upload(path,compressed,{contentType:compressed.type,upsert:false})
    if(upload.error){setSaving(false);return toast.error(upload.error.message)}
    const{error}=await supabase.rpc('set_order_delivery',{p_order_id:order.id,p_provider:provider,p_tracking:tracking,p_pickup:pickup?new Date(pickup).toISOString():null,p_estimated:eta?new Date(eta).toISOString():null,p_proof_url:path,p_actual_fee:Number(confirmedFee)})
    setSaving(false)
    if(error)return toast.error(error.message)
    toast.success('Delivery details saved and the order was marked Shipped.')
    onSaved?.();onClose()
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center bg-scrim/60 p-4">
    <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
      <div className="flex justify-between"><div><h2 className="font-display text-xl font-bold">Dispatch order</h2><p className="text-xs text-ink/45">{isPrepaid ? 'Shipping was charged automatically at checkout. Complete the dispatch details.' : 'The Reseller accepted the shipping fee. Complete the dispatch details.'}</p></div><button type="button" onClick={onClose}><X size={18}/></button></div>
      <div className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-900"><strong>{isPrepaid ? 'Shipping fee (charged automatically):' : 'Accepted shipping fee:'}</strong> {peso(confirmedFee)}</div>

      {checkingBooking ? (
        <div className="mt-5 flex justify-center py-6"><Loader2 size={20} className="animate-spin text-teal-600"/></div>
      ) : bookingActive ? (
        <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <div className="flex items-center gap-2 font-semibold text-teal-900"><Truck size={16}/>Booking via Lalamove automatically</div>
          <p className="mt-1.5 text-sm text-teal-800">{booking.lalamove_order_id ? `Booked — tracking ${booking.lalamove_order_id}. This order will move to Shipped automatically.` : 'A Lalamove delivery is being booked for this order. No manual dispatch is needed — this will update automatically.'}</p>
        </div>
      ) : (
        <form onSubmit={submit}>
          {bookingFailed && (
            <div className="mt-5 rounded-xl border border-coral-200 bg-coral-100 p-3 text-sm text-coral-700">
              <strong>Automatic Lalamove booking failed:</strong> {booking.failure_reason || 'Unknown error.'} Please dispatch manually below.
            </div>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Delivery provider<input required minLength="2" value={provider} onChange={e=>setProvider(e.target.value)} className="input-field mt-1" placeholder="Lalamove, J&T, Grab"/></label>
            <label className="text-sm font-semibold">Tracking / booking number<input required minLength="3" value={tracking} onChange={e=>setTracking(e.target.value)} className="input-field mt-1"/></label>
            <label className="text-sm font-semibold">Pickup schedule<input type="datetime-local" value={pickup} onChange={e=>setPickup(e.target.value)} className="input-field mt-1"/></label>
            <label className="text-sm font-semibold">Estimated delivery<input type="datetime-local" value={eta} onChange={e=>setEta(e.target.value)} className="input-field mt-1"/></label>
            <label className="text-sm font-semibold sm:col-span-2">Dispatch / booking proof<input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setProof(e.target.files?.[0]||null)} className="input-field mt-1"/></label>
          </div>
          <p className="mt-4 rounded-xl bg-teal-50 p-3 text-xs leading-5 text-teal-800">The buyer has seven days after the estimated delivery date to confirm receipt or open a dispute before automatic completion.</p>
          <button disabled={saving} className="btn-primary mt-5 flex w-full justify-center gap-2">{saving&&<Loader2 size={16} className="animate-spin"/>}Save and mark Shipped</button>
        </form>
      )}
    </div>
  </div>
}
