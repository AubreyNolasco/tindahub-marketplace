import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { MessageCircle, Package, PackageCheck, Plus, Store } from 'lucide-react'
import { peso } from '../../utils/format'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import toast from 'react-hot-toast'
import QuickAddModal from './QuickAddModal'
import { getResellerProfitEstimate, getSuggestedCustomerPrice } from '../../utils/pricing'

export default function ProductCard({ product }) {
  const { user, role } = useAuth()
  const { addItem } = useCart()
  const navigate = useNavigate()
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quantity, setQuantity] = useState(product.min_order_qty || 1)
  const inStock = product.stock_quantity >= (product.min_order_qty || 1)
  const bestDiscount = Number(product.campaign_discount_percent) || (product.discount_tiers || []).reduce((highest, tier) => Math.max(highest, Number(tier.discount_percent) || (1 - Number(tier.price) / Number(product.price)) * 100), 0)

  const handleAdd = (event) => {
    event.preventDefault()
    if (!inStock) return toast.error('Ubos na ang stock.')
    setQuantity(product.min_order_qty || 1)
    setShowQuickAdd(true)
  }

  const confirmAdd = (customer, sellingPrice) => {
    addItem(product, quantity, customer, sellingPrice)
    setShowQuickAdd(false)
    toast.success(`Naidagdag sa cart: ${product.name}`)
  }

  const handleMessage = (event) => {
    event.preventDefault()
    event.stopPropagation()
    navigate(`/${role}/chats/${product.merchant_id}`)
  }

  return <>
    <Link to={`/product/${product.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(20,32,25,0.04)] transition duration-300 hover:-translate-y-1 hover:border-teal-100 hover:shadow-soft">
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-teal-50 to-[#f8fbf8]">
        {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Package className="text-teal-300" size={42} /></div>}
        <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur ${inStock ? 'bg-white/90 text-teal-700' : 'bg-coral-500/90 text-white'}`}>{inStock ? 'In stock' : 'Out of stock'}</span>
        {bestDiscount > 0 && <span className="absolute right-2.5 top-2.5 rounded-full bg-mango-500 px-2.5 py-1 text-[10px] font-bold text-ink shadow-sm">{product.campaign_discount_percent ? 'CAMPAIGN ' : 'Up to '}{Math.round(bestDiscount)}% OFF</span>}
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-teal-700 sm:text-xs"><Store size={12} className="shrink-0" /><span className="truncate">{product.merchant_profiles?.business_name || 'Store'}</span></p>
          {user && user.id !== product.merchant_id && (role === 'reseller' || role === 'merchant') && <button onClick={handleMessage} className="shrink-0 rounded-full p-1.5 text-ink/40 transition hover:bg-teal-50 hover:text-teal-600" title="I-message ang store"><MessageCircle size={15} /></button>}
        </div>
        <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-ink sm:text-[15px]">{product.name}</h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div><span className="font-display text-base font-bold text-teal-700 sm:text-lg">{peso(role === 'reseller' ? getResellerProfitEstimate(product, Math.max(1, product.min_order_qty || 1)).buyingUnitPrice : product.price)}</span><p className="mt-1 flex items-center gap-1 text-[10px] text-ink/40 sm:text-xs"><PackageCheck size={12} />{inStock ? `${product.stock_quantity} available` : 'Unavailable'}</p></div>
          {(role === 'reseller' || role === 'merchant') && <button onClick={handleAdd} disabled={!inStock} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-600 text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-black/15 sm:h-10 sm:w-10" title="Idagdag sa cart"><Plus size={17} /></button>}
        </div>
        {product.min_order_qty > 1 && <p className="mt-2 border-t border-black/[0.05] pt-2 text-[10px] text-ink/40 sm:text-xs">Minimum order: {product.min_order_qty}</p>}
        {role === 'reseller' && <div className="mt-2 rounded-xl bg-mango-100/60 px-3 py-2 text-[10px] leading-4"><p className="font-bold text-ink">Sell at {peso(getSuggestedCustomerPrice(product))}</p><p className="text-teal-700">Est. profit: {peso(getResellerProfitEstimate(product, Math.max(1, product.min_order_qty || 1)).estimatedProfit)} for {Math.max(1, product.min_order_qty || 1)} item{Number(product.min_order_qty || 1) === 1 ? '' : 's'}</p></div>}
      </div>
    </Link>
    {showQuickAdd && <QuickAddModal product={product} quantity={quantity} onQuantityChange={setQuantity} onClose={() => setShowQuickAdd(false)} onAdd={confirmAdd} />}
  </>
}
