import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, UserRound } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import { peso } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import { getUnitPrice } from '../../utils/pricing'
import { getResellerUnitPrice } from '../../utils/pricing'
import { useAuth } from '../../contexts/AuthContext'

export default function Cart() {
  const { groupedOrders, updateQuantity, removeItem, totalAmount } = useCart()
  const { role } = useAuth()
  const navigate = useNavigate()
  const orderKeys = Object.keys(groupedOrders)

  if (orderKeys.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          message="Browse products in the catalog first."
          action={<Link to="/catalog" className="btn-primary">Shop Now</Link>}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-1">Cart</h1>
      <p className="text-ink/60 text-sm mb-6">
        Hiwalay na order ang bawat merchant dahil isang checkout lang bawat tindahan.
      </p>

      <div className="space-y-6">
        {orderKeys.map((orderKey) => {
          const group = groupedOrders[orderKey]
          const { merchantId, customerId, items } = group
          const unitPrice = (item) => role === 'reseller' ? getResellerUnitPrice(item, item.quantity) : getUnitPrice(item, item.quantity)
          const subtotal = items.reduce((s, i) => s + unitPrice(i) * i.quantity, 0)
          return (
            <div key={orderKey} className="card p-5">
              {customerId && <div className="mb-4 flex items-start gap-3 rounded-xl bg-teal-50 p-3"><UserRound size={18} className="mt-0.5 shrink-0 text-teal-600" /><div><p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Customer</p><p className="font-semibold text-ink">{group.customerName}</p><p className="text-xs text-ink/55">{group.customerPhone || 'No phone'} · {group.customerAddress || 'No address'}</p></div></div>}
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.cart_key} className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-teal-50 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">{item.name}</p>
                      <p className="text-sm text-teal-700 font-semibold">{peso(unitPrice(item))} each {role === 'reseller' && '· reseller price'}</p>
                      {role === 'reseller' && Number(item.suggested_retail_price) > unitPrice(item) && <p className="text-[11px] font-semibold text-mango-600">Potential gross margin: {peso((Number(item.suggested_retail_price) - unitPrice(item)) * item.quantity)} before fees and expenses</p>}
                    </div>
                    <div className="flex items-center border border-black/10 rounded-lg">
                      <button onClick={() => updateQuantity(item.cart_key, item.quantity - 1)} className="p-1.5 hover:bg-teal-50">
                        <Minus size={14} />
                      </button>
                      <span className="px-3 text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cart_key, item.quantity + 1)} className="p-1.5 hover:bg-teal-50">
                        <Plus size={14} />
                      </button>
                    </div>
                    <button onClick={() => removeItem(item.cart_key)} className="p-2 text-ink/40 hover:text-coral-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-black/5">
                <span className="text-sm text-ink/60">Subtotal: <span className="font-semibold text-ink">{peso(subtotal)}</span></span>
                <button
                  onClick={() => navigate(`/checkout/${merchantId}${customerId ? `?customer=${customerId}` : ''}`)}
                  className="btn-primary text-sm px-4 py-2"
                >
                  Check Out
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 text-right text-ink/70">
        Total ng lahat: <span className="font-display font-bold text-lg text-ink">{peso(totalAmount)}</span>
      </div>
    </div>
  )
}
