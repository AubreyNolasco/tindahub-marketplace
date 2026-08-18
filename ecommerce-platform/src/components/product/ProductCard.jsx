import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { MessageCircle, Package, PackageCheck, Plus, Store } from 'lucide-react'
import { compactCount, peso } from '../../utils/format'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import toast from 'react-hot-toast'
import QuickAddModal from './QuickAddModal'
import StarRating from './StarRating'
import { getResellerProfitEstimate, getSuggestedCustomerPrice, getUnitPrice } from '../../utils/pricing'

export default function ProductCard({ product }) {
  const { user, role } = useAuth()
  const { addItem } = useCart()
  const navigate = useNavigate()
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quantity, setQuantity] = useState(product.min_order_qty || 1)
  const inStock = product.stock_quantity >= (product.min_order_qty || 1)
  const bestDiscount = Number(product.campaign_discount_percent) || (product.discount_tiers || []).reduce((highest, tier) => Math.max(highest, Number(tier.discount_percent) || (1 - Number(tier.price) / Number(product.price)) * 100), 0)
  // Effective sticker price after any active discount — reused as-is
  // from the same helper Cart/Checkout use, so the badge and the price
  // shown here never disagree with each other.
  const displayPrice = role === 'reseller' ? getResellerProfitEstimate(product, Math.max(1, product.min_order_qty || 1)).buyingUnitPrice : getUnitPrice(product, product.min_order_qty || 1)
  const hasRating = Number(product.review_count) > 0
  const hasSold = Number(product.sold_count) > 0

  const handleAdd = (event) => {
    event.preventDefault()
    if (!inStock) return toast.error('This product is out of stock.')
    setQuantity(product.min_order_qty || 1)
    setShowQuickAdd(true)
  }

  const confirmAdd = (customer, sellingPrice) => {
    addItem(product, quantity, customer, sellingPrice)
    setShowQuickAdd(false)
    toast.success(`Added to cart: ${product.name}`)
  }

  const handleMessage = (event) => {
    event.preventDefault()
    event.stopPropagation()
    navigate(`/${role}/chats/${product.merchant_id}`)
  }

  return <>
    <Link to={`/product/${product.id}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-black/[0.06] bg-surface shadow-[0_2px_12px_rgba(20,32,25,0.04)] transition duration-300 hover:-translate-y-1 hover:border-teal-100 hover:shadow-soft sm:rounded-2xl">
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-teal-50 to-[#f8fbf8]">
        {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Package className="text-teal-300" size={42} /></div>}
        {/* Corner discount ribbon, top-left — the flash-sale-style badge
            marketplace shoppers scan for first, kept out of the way of
            the stock pill on the opposite corner. */}
        {bestDiscount > 0 && <span className="absolute left-0 top-2 rounded-r-md bg-coral-600 py-0.5 pl-1.5 pr-2 text-[8px] font-extrabold text-white shadow-sm sm:py-1 sm:pl-2.5 sm:pr-3.5 sm:text-xs">-{Math.round(bestDiscount)}%</span>}
        <span className={`absolute right-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded-full px-1.5 py-0.5 text-[7px] font-bold shadow-sm backdrop-blur sm:right-2.5 sm:top-2.5 sm:px-2.5 sm:py-1 sm:text-[10px] ${inStock ? 'bg-white/90 text-teal-700' : 'bg-coral-500/90 text-white'}`}>{inStock ? 'In stock' : 'Out of stock'}</span>
      </div>
      <div className="flex flex-1 flex-col p-1.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1 truncate text-[7px] font-bold uppercase tracking-wide text-teal-700 sm:gap-1.5 sm:text-xs"><Store size={12} className="hidden shrink-0 sm:block" /><span className="truncate">{product.merchant_profiles?.business_name || 'Store'}</span></p>
          {user && user.id !== product.merchant_id && (role === 'reseller' || role === 'merchant') && <button onClick={handleMessage} className="hidden shrink-0 rounded-full p-1.5 text-ink/40 transition hover:bg-teal-50 hover:text-teal-600 sm:block" title="Message the store"><MessageCircle size={15} /></button>}
        </div>
        <h3 className="mt-1 line-clamp-2 min-h-[1.75rem] break-words text-[9px] font-semibold leading-3.5 text-ink sm:mt-2 sm:min-h-[2.5rem] sm:text-[15px] sm:leading-5">{product.name}</h3>
        {(hasRating || hasSold) && <div className="mt-1 flex items-center gap-1 text-[7px] text-ink/45 sm:gap-1.5 sm:text-[11px]">
          {hasRating && <><StarRating value={product.avg_rating} size={9} /><span className="font-semibold text-ink/60">{Number(product.avg_rating).toFixed(1)}</span></>}
          {hasSold && <span className={hasRating ? 'before:mr-1 before:content-["·"]' : ''}>{compactCount(product.sold_count)} sold</span>}
        </div>}
        <div className="mt-auto pt-1.5 sm:pt-4">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span className={`block font-display text-[10px] font-bold sm:text-lg ${bestDiscount > 0 ? 'text-coral-600' : 'text-teal-700'}`}>{peso(displayPrice)}</span>
            {bestDiscount > 0 && role !== 'reseller' && <span className="text-[8px] text-ink/35 line-through sm:text-xs">{peso(product.price)}</span>}
          </div>
          <div className="mt-1 flex items-end justify-between gap-1 sm:mt-1.5">
            <p className="flex items-center gap-1 text-xs text-ink/40"><PackageCheck size={12} className="hidden sm:block" />{inStock ? `${product.stock_quantity} available` : 'Unavailable'}</p>
            {(role === 'reseller' || role === 'merchant') && <button onClick={handleAdd} disabled={!inStock} className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-teal-600 text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-black/15 sm:h-10 sm:w-10 sm:rounded-xl" title="Add to cart"><Plus size={14} className="sm:h-[17px] sm:w-[17px]" /></button>}
          </div>
        </div>
        {product.min_order_qty > 1 && <p className="mt-1 truncate border-t border-black/[0.05] pt-1 text-[7px] text-ink/40 sm:mt-2 sm:pt-2 sm:text-xs">Minimum: {product.min_order_qty}</p>}
        {role === 'reseller' && <div className="mt-1 rounded-md bg-mango-100/60 px-1.5 py-1 text-[7px] leading-3 sm:mt-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-[10px] sm:leading-4"><p className="truncate font-bold text-ink">Sell {peso(getSuggestedCustomerPrice(product))}</p><p className="truncate text-teal-700">Profit {peso(getResellerProfitEstimate(product, Math.max(1, product.min_order_qty || 1)).estimatedProfit)}</p><p className="hidden text-teal-700 sm:block">for {Math.max(1, product.min_order_qty || 1)} item{Number(product.min_order_qty || 1) === 1 ? '' : 's'}</p></div>}
      </div>
    </Link>
    {showQuickAdd && <QuickAddModal product={product} quantity={quantity} onQuantityChange={setQuantity} onClose={() => setShowQuickAdd(false)} onAdd={confirmAdd} />}
  </>
}
