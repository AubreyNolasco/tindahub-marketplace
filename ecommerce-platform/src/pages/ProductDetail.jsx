import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, Check, MessageCircle, Minus, Package, PackageSearch, Plus, ShieldCheck, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { compactCount, peso } from '../utils/format'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import QuickAddModal from '../components/product/QuickAddModal'
import StarRating from '../components/product/StarRating'
import { getUnitPrice, getResellerUnitPrice } from '../utils/pricing'
import { applyCampaignDiscount, getActiveCampaignDiscounts, getActiveCampaignProducts } from '../utils/campaigns'
import CampaignCountdown from '../components/product/CampaignCountdown'
import { getSuggestedCustomerPrice } from '../utils/pricing'
import ResellerProfitPanel from '../components/product/ResellerProfitPanel'
import { isStoreOpen } from '../utils/storeHours'

export default function ProductDetail() {
  const { id } = useParams()
  const { user, role } = useAuth()
  const { addItem } = useCart()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [soldCount, setSoldCount] = useState(0)
  const [activeImage, setActiveImage] = useState(0)
  const [eligibleOrder, setEligibleOrder] = useState(null)
  const [myReview, setMyReview] = useState(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [customerSellingPrice, setCustomerSellingPrice] = useState(0)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [buyNow, setBuyNow] = useState(false)
  const [listedForCustomers, setListedForCustomers] = useState(false)
  const [listing, setListing] = useState(false)

  const loadReviews = useCallback(async () => {
    const { data, error } = await supabase.from('product_reviews').select('*').eq('product_id', id).order('created_at', { ascending: false })
    if (!error) setReviews(data || [])
  }, [id])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.from('products').select('*, merchant_profiles(business_name,store_open_time,store_close_time,auto_pause_outside_hours,store_timezone)').eq('id', id).maybeSingle()
      if (!error && data) {
        const [discounts, campaignProducts, soldResult] = await Promise.all([getActiveCampaignDiscounts(), getActiveCampaignProducts(), supabase.rpc('get_product_sold_counts', { p_product_ids: [id] })])
        setProduct(applyCampaignDiscount(data, discounts, campaignProducts))
        setQty(data.min_order_qty || 1)
        setCustomerSellingPrice(getSuggestedCustomerPrice(data))
        setSoldCount(soldResult.data?.[0]?.sold_count || 0)
        setActiveImage(0)
      }
      await loadReviews()
      setLoading(false)
    }
    load()
  }, [id, loadReviews])

  useEffect(() => {
    if (!user || role !== 'reseller') return
    Promise.all([
      supabase.from('orders').select('id, order_items!inner(product_id)').eq('reseller_id', user.id).eq('status', 'completed').eq('order_items.product_id', id).limit(1),
      supabase.from('product_reviews').select('*').eq('product_id', id).eq('reseller_id', user.id).maybeSingle(),
      supabase.from('reseller_storefront_products').select('product_id').eq('reseller_id',user.id).eq('product_id',id).maybeSingle(),
    ]).then(([orderResult, reviewResult, listingResult]) => {
      setEligibleOrder(orderResult.data?.[0] || null)
      if (reviewResult.data) { setMyReview(reviewResult.data); setRating(reviewResult.data.rating); setComment(reviewResult.data.comment) }
      setListedForCustomers(Boolean(listingResult.data))
    })
  }, [id, user, role])

  const average = useMemo(() => reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0, [reviews])
  const submitReview = async (event) => {
    event.preventDefault()
    if (!eligibleOrder || comment.trim().length < 3) return toast.error('Please enter a helpful review.')
    setSubmitting(true)
    const payload = { product_id: id, reseller_id: user.id, order_id: eligibleOrder.id, rating, comment: comment.trim() }
    const result = myReview ? await supabase.from('product_reviews').update({ rating, comment: payload.comment }).eq('id', myReview.id) : await supabase.from('product_reviews').insert(payload)
    setSubmitting(false)
    if (result.error) return toast.error(result.error.message)
    toast.success(myReview ? 'Review updated.' : 'Thank you for your review!')
    const { data } = await supabase.from('product_reviews').select('*').eq('product_id', id).eq('reseller_id', user.id).maybeSingle()
    setMyReview(data)
    loadReviews()
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!product) return <div className="mx-auto max-w-3xl px-4 py-16"><EmptyState icon={PackageSearch} title="Product Not Found" message="This item may have been removed or hidden by the Merchant." action={<Link to="/catalog" className="btn-primary">Back to Catalog</Link>} /></div>

  const confirmAdd = (customer, sellingPrice) => {
    addItem(product, qty, customer, sellingPrice)
    setShowQuickAdd(false)
    if (buyNow) { setBuyNow(false); navigate('/cart'); return }
    toast.success(`Added to cart: ${product.name}`)
  }
  const openQuickAdd = (isBuyNow) => { setBuyNow(isBuyNow); setShowQuickAdd(true) }
  const getForProductList = async () => {
    if(listedForCustomers)return
    setListing(true)
    const{error}=await supabase.from('reseller_storefront_products').insert({reseller_id:user.id,product_id:id})
    setListing(false)
    if(error)return toast.error(error.message)
    setListedForCustomers(true)
    toast.success('Product added to My Product List and customer storefront.')
  }
  const storeOpen = isStoreOpen(product.merchant_profiles)

  return <div className="min-h-screen bg-bg py-6 sm:py-10"><div className="mx-auto max-w-6xl px-4 sm:px-6">
    <div className="mb-5 text-sm text-ink/45"><Link to="/catalog" className="hover:text-teal-700">Products</Link><span className="mx-2">/</span><span className="text-ink/65">{product.name}</span></div>
    <section className="grid overflow-hidden rounded-3xl border border-black/[0.06] bg-surface shadow-soft md:grid-cols-2">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 to-white">{product.images?.[activeImage] ? <img src={product.images[activeImage]} alt={product.name} className="h-full w-full object-cover" /> : <Package className="text-teal-300" size={72} />}<span className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${product.stock_quantity > 0 ? 'bg-white/90 text-teal-700' : 'bg-coral-500 text-white'}`}>{product.stock_quantity > 0 ? 'In stock' : 'Out of stock'}</span></div>
        {product.images?.length > 1 && <div className="flex gap-2 overflow-x-auto">{product.images.map((image, index) => <button key={image + index} type="button" onClick={() => setActiveImage(index)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${activeImage === index ? 'border-teal-600' : 'border-transparent opacity-70 hover:opacity-100'}`}><img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" /></button>)}</div>}
      </div>
      <div className="flex flex-col p-5 sm:p-8 lg:p-10"><div className="flex flex-wrap items-center gap-3"><Link to={`/merchant-store/${product.merchant_id}`} className="flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-900"><Store size={15} />{product.merchant_profiles?.business_name}</Link>{user && user.id !== product.merchant_id && (role === 'reseller' || role === 'merchant') && <Link to={`/${role}/chats/${product.merchant_id}`} className="flex items-center gap-1.5 text-sm text-ink/45 hover:text-teal-600"><MessageCircle size={15} /> Message store</Link>}</div>
        <h1 className="mt-4 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl lg:text-4xl">{product.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href="#reviews" className="flex w-fit items-center gap-2"><StarRating value={average} /><span className="text-sm font-semibold text-ink/55">{reviews.length ? `${average.toFixed(1)} (${reviews.length} review${reviews.length === 1 ? '' : 's'})` : 'No ratings yet'}</span></a>
          {soldCount > 0 && <span className="text-sm text-ink/40">· {compactCount(soldCount)} sold</span>}
        </div>
        <div className="mt-6 border-y border-black/[0.06] py-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/40">{role === 'reseller' ? 'Your reseller buying price' : 'Retail price'}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className={`font-display text-3xl font-bold ${product.campaign_discount_percent > 0 && role !== 'reseller' ? 'text-coral-600' : 'text-teal-700'}`}>{peso(role === 'reseller' ? getResellerUnitPrice(product, qty) : getUnitPrice(product, qty))} {role === 'reseller' && <span className="text-sm font-medium text-ink/40">each at {qty} item{qty === 1 ? '' : 's'}</span>}</p>
            {product.campaign_discount_percent > 0 && role !== 'reseller' && <span className="text-lg text-ink/35 line-through">{peso(product.price)}</span>}
          </div>
          {role !== 'reseller' && product.wholesale_price && <p className="mt-1 text-sm text-ink/45">Reseller wholesale price available from {peso(product.wholesale_price)}</p>}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-surface-inset p-3"><p className="text-xs text-ink/40">Available stock</p><p className="mt-1 font-semibold text-ink">{product.stock_quantity} items</p></div><div className="rounded-xl bg-surface-inset p-3"><p className="text-xs text-ink/40">Minimum order</p><p className="mt-1 font-semibold text-ink">{product.min_order_qty} item{product.min_order_qty === 1 ? '' : 's'}</p></div></div>
        {product.campaign_discount_percent > 0 ? <div className="mt-4 overflow-hidden rounded-2xl border border-mango-300 bg-gradient-to-br from-mango-100 to-mango-50 p-4 dark:border-mango-700 dark:from-mango-500/10 dark:to-mango-500/5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-mango-600">{product.campaign_name || 'Marketplace campaign'}</p>{product.campaign_ends_at && <CampaignCountdown endsAt={product.campaign_ends_at} className="text-[11px] text-mango-700" />}</div><div className="mt-2 flex items-center justify-between"><span className="font-display text-xl font-bold text-ink">{product.campaign_discount_percent}% OFF</span><span className="text-right"><span className="mr-2 text-sm text-ink/40 line-through">{peso(product.price)}</span><span className="font-bold text-teal-700">{peso(getUnitPrice(product, qty))} each</span></span></div><p className="mt-2 text-xs text-ink/50">Campaign price applies to every quantity. Store quantity discounts are paused.</p></div> : product.discount_tiers?.length > 0 && <div className="mt-4 rounded-2xl border border-mango-300/50 bg-mango-100/40 p-4 dark:border-mango-700/50 dark:bg-mango-500/10"><p className="text-xs font-bold uppercase tracking-wide text-mango-600">Reseller quantity discounts</p><div className="mt-2 space-y-2">{product.discount_tiers.map((tier) => { const percent = Number(tier.discount_percent) || Number(((1 - Number(tier.price) / Number(product.price)) * 100).toFixed(2)); return <div key={tier.min_qty} className="flex items-center justify-between gap-3 text-sm"><span className="text-ink/60">Buy {tier.min_qty}+ items</span><span className="text-right"><strong className="text-mango-600">{percent}% OFF</strong><span className="ml-2 font-bold text-teal-700">{peso(tier.price)} each</span></span></div> })}</div></div>}
        {(role === 'reseller' ? getResellerUnitPrice(product, qty) : getUnitPrice(product, qty)) < Number(product.price) && <div className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-700"><strong>Your buying price: {peso(role === 'reseller' ? getResellerUnitPrice(product, qty) : getUnitPrice(product, qty))} each</strong><span className="ml-2">Total product discount: {peso((Number(product.price) - (role === 'reseller' ? getResellerUnitPrice(product, qty) : getUnitPrice(product, qty))) * qty)}</span></div>}
        {role === 'reseller' && <div className="mt-4"><ResellerProfitPanel product={product} quantity={qty} sellingPrice={customerSellingPrice} onSellingPriceChange={setCustomerSellingPrice} /></div>}
        {role === 'reseller' && <button onClick={getForProductList} disabled={listedForCustomers||listing} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${listedForCustomers?'bg-teal-50 text-teal-700':'border border-teal-200 bg-surface text-teal-700 hover:bg-teal-50'}`}>{listedForCustomers?<><Check size={16}/> Already in My Product List</>:listing?'Adding product...':<><Plus size={16}/> Get for My Product List</>}</button>}
        {!storeOpen && <div className="mt-4 rounded-xl bg-mango-100 p-3 text-sm font-semibold text-mango-700">Store is currently closed. Products will be available again during store hours.</div>}
        {(role === 'reseller' || role === 'merchant') && <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
          <div className="flex items-center overflow-hidden rounded-xl border border-black/10"><button onClick={() => setQty((value) => Math.max(product.min_order_qty, value - 1))} className="p-3 hover:bg-teal-50"><Minus size={16} /></button><span className="min-w-10 text-center font-semibold">{qty}</span><button onClick={() => setQty((value) => Math.min(product.stock_quantity, value + 1))} className="p-3 hover:bg-teal-50"><Plus size={16} /></button></div>
          {(() => { const disabled = !storeOpen || product.stock_quantity < product.min_order_qty; const label = !storeOpen ? 'Store Closed' : product.stock_quantity < product.min_order_qty ? 'Out of Stock' : null
            return <>
              <button onClick={() => openQuickAdd(false)} disabled={disabled} className="btn-secondary flex-1 py-3">{label || 'Add to Cart'}</button>
              <button onClick={() => openQuickAdd(true)} disabled={disabled} className="btn-primary flex-1 py-3">{label || 'Buy Now'}</button>
            </>
          })()}
        </div>}
        {!role && <div className="mt-6 rounded-xl bg-teal-50 p-4 text-sm text-teal-700"><Link to="/login" className="font-semibold underline">Log in</Link> as a reseller to purchase.</div>}
      </div>
    </section>

    <section className="mt-6 rounded-3xl border border-black/[0.06] bg-surface p-5 shadow-soft sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-600">Product information</p><h2 className="mt-2 font-display text-2xl font-bold text-ink">Description</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-ink/65 sm:text-base">{product.description || 'No additional product description is available.'}</p></section>

    <section id="reviews" className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-3xl border border-black/[0.06] bg-surface p-5 shadow-soft sm:p-8"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-600">Verified feedback</p><h2 className="mt-2 font-display text-2xl font-bold text-ink">Reseller Reviews</h2></div><div className="text-right"><p className="font-display text-3xl font-bold text-ink">{average ? average.toFixed(1) : '—'}</p><StarRating value={average} size={14} /></div></div>
        {reviews.length === 0 ? <div className="mt-6 rounded-2xl bg-surface-inset p-8 text-center"><p className="font-semibold text-ink">No reviews yet</p><p className="mt-1 text-sm text-ink/45">The first verified reseller review will appear here.</p></div> : <div className="mt-6 divide-y divide-black/[0.06]">{reviews.map((review) => <article key={review.id} className="py-5 first:pt-0"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink">{review.reviewer_name}</p><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-teal-700"><BadgeCheck size={14} /> Verified purchase</p></div><div className="text-right"><StarRating value={review.rating} size={14} /><p className="mt-1 text-[11px] text-ink/35">{new Date(review.created_at).toLocaleDateString()}</p></div></div><p className="mt-3 text-sm leading-6 text-ink/65">{review.comment}</p></article>)}</div>}
      </div>
      <aside>{role === 'reseller' && eligibleOrder ? <form onSubmit={submitReview} className="sticky top-24 rounded-3xl border border-black/[0.06] bg-surface p-5 shadow-soft"><h3 className="font-display font-bold text-ink">{myReview ? 'Update your review' : 'Rate this product'}</h3><p className="mt-1 text-xs text-ink/45">Your review will be marked as verified.</p><div className="mt-4"><StarRating value={rating} onChange={setRating} size={24} /></div><textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, 1000))} rows="5" className="input-field mt-4 resize-none text-sm" placeholder="Share your experience with this product..." required minLength="3" /><div className="mt-1 text-right text-[10px] text-ink/35">{comment.length}/1000</div><button disabled={submitting} className="btn-primary mt-3 w-full">{submitting ? 'Saving...' : myReview ? 'Update review' : 'Submit review'}</button></form> : <div className="rounded-3xl border border-black/[0.06] bg-teal-50 p-5"><ShieldCheck className="text-teal-600" size={24} /><h3 className="mt-3 font-display font-bold text-teal-900">Verified reviews only</h3><p className="mt-2 text-sm leading-6 text-ink/55">Resellers can leave a rating after their order for this product is completed.</p></div>}</aside>
    </section>
    {showQuickAdd && <QuickAddModal product={product} quantity={qty} initialSellingPrice={customerSellingPrice} onQuantityChange={setQty} onClose={() => setShowQuickAdd(false)} onAdd={confirmAdd} />}
  </div></div>
}
