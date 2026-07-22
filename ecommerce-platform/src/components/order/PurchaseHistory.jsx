import { useEffect, useState } from 'react'
import { CircleDollarSign, ClipboardList, PackageCheck, Printer, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, ORDER_STATUS_STYLES, ORDER_STATUS_LABELS } from '../../utils/format'
import EmptyState from '../ui/EmptyState'
import Spinner from '../ui/Spinner'
import OrderCaseModal from './OrderCaseModal'
import CustomerPaymentModal from './CustomerPaymentModal'
import { realizedResellerMargin } from '../../utils/orderProcess'
import { printReceipt } from '../../utils/receipt'

export default function PurchaseHistory() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null)
  const [caseOrder,setCaseOrder]=useState(null)
  const [paymentOrder,setPaymentOrder]=useState(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, merchant_profiles(business_name), order_items(*), order_cases(id,case_type,status,created_at), customer_payment_records(*)')
      .eq('reseller_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setOrders(data || [])
    setLoading(false)
  }

  const confirmReceived = async (order) => {
    setConfirming(order.id)
    const { error } = await supabase.from('orders').update({ status: 'completed', delivered_at: new Date().toISOString() }).eq('id', order.id)
    setConfirming(null)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Thank you! The merchant payout has been released.')
    load()
  }
  const viewDispatchProof=async order=>{const{data,error}=await supabase.storage.from('delivery-proofs').createSignedUrl(order.dispatch_proof_url,300);if(error)return toast.error(error.message);window.open(data.signedUrl,'_blank','noopener,noreferrer')}

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">My Orders</h1>
      {orders.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No orders yet" message="Place your first order from the catalog." />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-ink/60">{o.order_number}</span>
                <span className={`badge ${ORDER_STATUS_STYLES[o.status]}`}>{ORDER_STATUS_LABELS[o.status]}</span>
              </div>
              <p className="text-sm text-ink/70">{o.merchant_profiles?.business_name} · {formatDate(o.created_at)}</p>
              <div className="mt-3 space-y-1 text-sm text-ink/60">
                {o.order_items?.map((it) => (
                  <div key={it.id} className="flex justify-between">
                    <span>{it.product_name} × {it.quantity}</span>
                    <span>{peso(it.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-semibold text-ink mt-3 pt-3 border-t border-black/5">
                <span>Total</span><span>{peso(o.total)}</span>
              </div>
              {o.delivery_provider&&<div className="mt-3 rounded-xl bg-teal-50 p-3 text-xs text-teal-900"><strong>{o.delivery_provider}</strong> · Tracking {o.tracking_number}{o.estimated_delivery_at&&<span className="block mt-1">Estimated delivery: {new Date(o.estimated_delivery_at).toLocaleString('en-PH')}</span>}{o.actual_shipping_fee!=null&&<span className="block mt-1">Actual courier fee: {peso(o.actual_shipping_fee)}</span>}{o.dispatch_proof_url&&<button onClick={()=>viewDispatchProof(o)} className="mt-2 font-bold underline">View dispatch proof</button>}</div>}
              {o.order_cases?.filter(c=>['open','merchant_review','admin_review'].includes(c.status)).map(c=><p key={c.id} className="mt-3 rounded-xl bg-coral-100 p-3 text-xs font-semibold text-coral-700">Open {c.case_type} request · {c.status.replace('_',' ')}</p>)}
              {o.customer_payment_records?.[0]&&<div className="mt-3 rounded-xl bg-mango-100/60 p-3 text-xs text-ink/65"><p>Customer payment: <strong className="capitalize">{o.customer_payment_records[0].status.replace('_',' ')}</strong> · Received {peso(o.customer_payment_records[0].received_amount)} of {peso(o.customer_payment_records[0].expected_amount)}</p>{o.customer_payment_records[0].status==='refunded'?<p className="mt-1 font-bold text-coral-700">Customer-side payment was recorded as refunded.</p>:<p className="mt-1 font-bold text-teal-800">{o.customer_payment_records[0].status==='paid'?'Realized':'Collected'} margin: {peso(realizedResellerMargin(o.customer_payment_records[0].received_amount,o.total))}</p>}</div>}
              {(() => {
                const resellerFee = Number(o.reseller_operation_fee) || 0
                return (
                  <div className="mt-2 space-y-1 text-xs text-ink/50">
                    <div className="flex justify-between"><span>Products subtotal</span><span>{peso(o.subtotal)}</span></div>
                    <div className="flex justify-between font-medium text-mango-600"><span>Shipping fee</span><span>{o.shipping_payment_method === 'receiver_pays_on_delivery' ? 'Pay upon delivery' : peso(o.shipping_fee)}</span></div>
                    <div className="flex justify-between"><span>1% Reseller System Fee</span><span>{peso(resellerFee)}</span></div>
                    {o.shipping_distance_km && <div className="flex justify-between"><span>Billing road distance</span><span>{o.shipping_distance_km} km</span></div>}
                    {o.shipping_payment_method === 'receiver_pays_on_delivery' && <p className="pt-1 leading-5 text-ink/45">Pay the actual delivery fee directly to the rider or delivery provider when the order arrives.</p>}
                  </div>
                )
              })()}

              {o.status === 'shipped' && (
                <button
                  onClick={() => confirmReceived(o)}
                  disabled={confirming === o.id}
                  className="btn-primary text-sm mt-3 flex items-center gap-1.5"
                >
                  <PackageCheck size={16} /> {confirming === o.id ? 'Confirming...' : 'Confirm Delivery'}
                </button>
              )}
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>printReceipt({title:'Marketplace Order',reference:o.order_number,status:o.status,date:formatDate(o.created_at),rows:[{label:'Merchant',value:o.merchant_profiles?.business_name},{label:'Products subtotal',value:peso(o.subtotal)},{label:'Reseller system fee',value:peso(o.reseller_operation_fee||0)},{label:'Wallet total',value:peso(o.total)},{label:'Delivery provider',value:o.delivery_provider||'Not dispatched'},{label:'Tracking number',value:o.tracking_number||'Not available'}],note:'Shipping may be paid separately to the rider when the order uses receiver-pays-on-delivery.'})} className="btn-secondary flex items-center gap-1.5 text-xs"><Printer size={15}/> Print receipt</button>{!['cancelled'].includes(o.status)&&<><button onClick={()=>setPaymentOrder(o)} className="btn-secondary flex items-center gap-1.5 text-xs"><CircleDollarSign size={15}/> Record customer payment</button>{o.status!=='completed'&&<button onClick={()=>setCaseOrder(o)} className="flex items-center gap-1.5 rounded-xl bg-coral-100 px-3 py-2 text-xs font-semibold text-coral-700"><ShieldAlert size={15}/> Request cancellation / help</button>}</>}</div>
            </div>
          ))}
        </div>
      )}
      <OrderCaseModal order={caseOrder} open={Boolean(caseOrder)} onClose={()=>setCaseOrder(null)} onSaved={load}/>
      <CustomerPaymentModal order={paymentOrder} open={Boolean(paymentOrder)} onClose={()=>setPaymentOrder(null)} onSaved={load}/>
    </div>
  )
}
