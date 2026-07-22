import { useEffect, useState } from 'react'
import { ClipboardList, PackageCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, ORDER_STATUS_STYLES, ORDER_STATUS_LABELS } from '../../utils/format'
import EmptyState from '../ui/EmptyState'
import Spinner from '../ui/Spinner'

export default function PurchaseHistory() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, merchant_profiles(business_name), order_items(*)')
      .eq('reseller_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setOrders(data || [])
    setLoading(false)
  }

  const confirmReceived = async (order) => {
    setConfirming(order.id)
    const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', order.id)
    setConfirming(null)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Thank you! The merchant payout has been released.')
    load()
  }

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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
