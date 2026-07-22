import { useEffect, useState } from 'react'
import { ClipboardList, Check, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, ORDER_STATUS_STYLES, ORDER_STATUS_LABELS } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import DeliveryProcessGuide from '../../components/order/DeliveryProcessGuide'

// Merchant can advance an order up to 'shipped'. Only the buyer's "Confirm
// Received" action (or an admin) can mark it 'completed' — that's what
// releases the escrowed payout, so the merchant can't self-complete it.
const NEXT_STATUS = {
  confirmed: 'processing',
  processing: 'shipped'
}

const STATUS_ERRORS = {
  NO_MERCHANT_WALLET: 'No merchant wallet was found for this account.',
  INSUFFICIENT_MERCHANT_FEE_BALANCE: 'Your wallet balance is insufficient for the 5% merchant operation fee.'
}

export default function Orders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [proofUrls, setProofUrls] = useState({})

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(*), customers(name, phone, address, notes)')
      .eq('merchant_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setOrders(data || [])
    setLoading(false)
  }

  const viewProof = async (order) => {
    const payment = order.payments?.[0]
    if (!payment?.proof_url) return
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(payment.proof_url, 300)
    if (error) {
      toast.error('Unable to load the proof of payment.')
      return
    }
    setProofUrls((p) => ({ ...p, [order.id]: data.signedUrl }))
  }

  const verifyPayment = async (order, approve) => {
    const payment = order.payments?.[0]
    if (!payment) return
    const { error } = await supabase
      .from('payments')
      .update({
        status: approve ? 'verified' : 'rejected',
        verified_by: user.id,
        verified_at: new Date().toISOString()
      })
      .eq('id', payment.id)

    if (error) {
      toast.error(error.message)
      return
    }
    if (!approve) {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    }
    toast.success(approve ? 'Payment verified!' : 'Payment rejected.')
    load()
  }

  const advanceStatus = async (order) => {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id)
    if (error) {
      toast.error(STATUS_ERRORS[error.message] || error.message)
      return
    }
    toast.success(`Order na-update sa: ${ORDER_STATUS_LABELS[next]}`)
    load()
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Orders</h1>
      <DeliveryProcessGuide audience="merchant" />

      {orders.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No orders yet" message="Orders will appear here when someone buys your products." />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const payment = o.payments?.[0]
            return (
              <div key={o.id} className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-ink/60">{o.order_number}</span>
                  <span className={`badge ${ORDER_STATUS_STYLES[o.status]}`}>{ORDER_STATUS_LABELS[o.status]}</span>
                </div>
                <p className="text-sm text-ink/60 mb-3">{formatDate(o.created_at)} · {o.shipping_address}</p>
                {o.customers && <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Customer details</p><p className="mt-1 font-semibold text-ink">{o.customers.name}</p><p className="text-sm text-ink/60">{o.customers.phone || 'No phone number'}</p><p className="text-sm text-ink/60">{o.customers.address || o.shipping_address}</p>{o.customers.notes && <p className="mt-1 text-xs text-ink/45">Note: {o.customers.notes}</p>}</div>}

                <div className="space-y-1 text-sm text-ink/70 mb-3">
                  {o.order_items?.map((it) => (
                    <div key={it.id} className="flex justify-between">
                      <span>{it.product_name} × {it.quantity}</span>
                      <span>{peso(it.line_total)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-semibold text-ink pt-3 border-t border-black/5 mb-3">
                  <span>Total</span><span>{peso(o.total)}</span>
                </div>
                {(() => {
                  const resellerFee = Number(o.reseller_operation_fee) || 0
                  const productAmount = Number(o.merchant_gross_amount) || Number(o.subtotal) || (Number(o.total) - resellerFee)
                  const merchantFee = Number(o.platform_fee) || Math.round(productAmount * 0.03 * 100) / 100
                  const orderPayout = Number(o.merchant_net_amount) || (productAmount - merchantFee)
                  return (
                    <div className="space-y-1 text-xs text-ink/50 -mt-1 mb-3">
                      <div className="flex justify-between"><span>Products subtotal</span><span>{peso(o.subtotal)}</span></div>
                      <div className="flex justify-between font-medium text-mango-600"><span>Shipping fee</span><span>{o.shipping_payment_method === 'receiver_pays_on_delivery' ? 'Receiver pays upon delivery' : peso(o.shipping_fee)}</span></div>
                      {o.shipping_distance_km && <div className="flex justify-between"><span>Billing road distance</span><span>{o.shipping_distance_km} km</span></div>}
                      <div className="flex justify-between"><span>5% Merchant Operation Fee (charged on Processing)</span><span>{peso(merchantFee)}</span></div>
                      <div className="flex justify-between font-semibold text-ink/70"><span>Order payout to wallet</span><span>{peso(orderPayout)}</span></div>
                    </div>
                  )
                })()}

                {payment && payment.status === 'submitted' && (
                  <div className="bg-mango-100 rounded-xl p-4">
                    <p className="text-sm font-semibold text-ink mb-2">
                      Review Payment ({payment.method.toUpperCase()}) — Ref# {payment.reference_number || '—'}
                    </p>
                    {proofUrls[o.id] ? (
                      <img src={proofUrls[o.id]} alt="proof" className="max-h-56 rounded-lg mb-3" />
                    ) : (
                      <button onClick={() => viewProof(o)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 mb-3">
                        <Eye size={14} /> View Proof
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => verifyPayment(o, true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                        <Check size={14} /> I-verify
                      </button>
                      <button onClick={() => verifyPayment(o, false)} className="text-xs px-3 py-1.5 rounded-xl bg-coral-100 text-coral-600 font-semibold flex items-center gap-1">
                        <X size={14} /> I-reject
                      </button>
                    </div>
                  </div>
                )}

                {NEXT_STATUS[o.status] && (
                  <button onClick={() => advanceStatus(o)} className="btn-primary text-sm mt-3">
                    Markahan bilang "{ORDER_STATUS_LABELS[NEXT_STATUS[o.status]]}"
                  </button>
                )}
                {o.status === 'shipped' && (
                  <p className="text-xs text-ink/50 mt-3">
                    Awaiting buyer confirmation — your payout will be released to your wallet after delivery is confirmed.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
