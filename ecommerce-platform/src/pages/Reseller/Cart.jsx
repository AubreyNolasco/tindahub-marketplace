import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, UserRound } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import { peso } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import { getUnitPrice } from '../../utils/pricing'
import { getResellerOperationFee, getResellerUnitPrice, getSuggestedCustomerPrice } from '../../utils/pricing'
import { useAuth } from '../../contexts/AuthContext'

export default function Cart() {
  const { groupedOrders, updateQuantity, updateSellingPrice, removeItem, totalAmount } = useCart()
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
        Products from each Merchant are placed in separate orders because each checkout supports one store.
      </p>

      <div className="space-y-6">
        {orderKeys.map((orderKey) => {
          const group = groupedOrders[orderKey]
          const { merchantId, customerId, items } = group
          const unitPrice = (item) => role === 'reseller' ? getResellerUnitPrice(item, item.quantity) : getUnitPrice(item, item.quantity)
          const subtotal = items.reduce((s, i) => s + unitPrice(i) * i.quantity, 0)
          const customerRevenue = items.reduce((sum, item) => sum + Number(item.customer_selling_price ?? getSuggestedCustomerPrice(item)) * item.quantity, 0)
          const systemFee = role === 'reseller' ? getResellerOperationFee(subtotal) : 0
          const estimatedProfit = customerRevenue - subtotal - systemFee
          return (
            <div key={orderKey} className="card p-4 sm:p-5">
              {customerId && <div className="mb-4 flex items-start gap-3 rounded-xl bg-teal-50 p-3 dark:bg-teal-500/10"><UserRound size={18} className="mt-0.5 shrink-0 text-teal-600" /><div><p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Customer</p><p className="font-semibold text-ink">{group.customerName}</p><p className="text-xs text-ink/55">{group.customerPhone || 'No phone'} · {group.customerAddress || 'No address'}</p></div></div>}
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.cart_key} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 sm:flex sm:gap-4">
                    <div className="h-14 w-14 overflow-hidden rounded-lg bg-teal-50 sm:h-16 sm:w-16 sm:flex-shrink-0">
                      {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">{item.name}</p>
                      <p className="text-sm text-teal-700 font-semibold">{peso(unitPrice(item))} each {role === 'reseller' && '· reseller price'}</p>
                      {role === 'reseller' && <label className="mt-2 block max-w-[190px] text-[10px] font-semibold text-ink/50">Selling price per item<input type="number" min="0" step="0.01" value={item.customer_selling_price ?? getSuggestedCustomerPrice(item)} onChange={(event) => updateSellingPrice(item.cart_key, event.target.value)} className="input-field mt-1 px-2 py-1.5 text-xs" /></label>}
                      {role === 'reseller' && <p className={`mt-1 text-[11px] font-semibold ${(Number(item.customer_selling_price ?? getSuggestedCustomerPrice(item)) - unitPrice(item)) * item.quantity > 0 ? 'text-mango-600' : 'text-coral-600'}`}>Item gross profit: {peso((Number(item.customer_selling_price ?? getSuggestedCustomerPrice(item)) - unitPrice(item)) * item.quantity)}</p>}
                    </div>
                    <div className="col-start-2 flex w-fit items-center rounded-lg border border-black/10 sm:col-auto">
                      <button onClick={() => updateQuantity(item.cart_key, item.quantity - 1)} className="p-1.5 hover:bg-teal-50" aria-label="Decrease quantity">
                        <Minus size={14} />
                      </button>
                      <span className="px-3 text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cart_key, item.quantity + 1)} className="p-1.5 hover:bg-teal-50" aria-label="Increase quantity">
                        <Plus size={14} />
                      </button>
                    </div>
                    <button onClick={() => removeItem(item.cart_key)} className="col-start-3 row-start-1 grid h-10 w-10 place-items-center rounded-lg text-ink/40 hover:bg-coral-50 hover:text-coral-500 sm:col-auto sm:row-auto" aria-label={`Remove ${item.name} from cart`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {role === 'reseller' && <div className={`mt-4 grid grid-cols-2 gap-3 rounded-xl p-3 sm:grid-cols-4 ${estimatedProfit > 0 ? 'bg-mango-100/60' : 'bg-coral-50'}`}><div><p className="text-[10px] text-ink/40">Buying total</p><p className="text-sm font-bold text-teal-700">{peso(subtotal)}</p></div><div><p className="text-[10px] text-ink/40">Customer total</p><p className="text-sm font-bold text-ink">{peso(customerRevenue)}</p></div><div><p className="text-[10px] text-ink/40">System fee</p><p className="text-sm font-bold text-ink">{peso(systemFee)}</p></div><div><p className="text-[10px] text-ink/40">Estimated profit</p><p className={`text-sm font-extrabold ${estimatedProfit > 0 ? 'text-teal-700' : 'text-coral-600'}`}>{peso(estimatedProfit)}</p></div></div>}
              <div className="mt-4 flex flex-col gap-3 border-t border-black/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-ink/60">Amount paid to JOM HUB: <span className="font-semibold text-ink">{peso(subtotal + systemFee)}</span></span>
                <button
                  onClick={() => navigate(`/checkout/${merchantId}${customerId ? `?customer=${customerId}` : ''}`)}
                  className="btn-primary w-full px-4 py-2 text-sm sm:w-auto"
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
