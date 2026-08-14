import { useEffect, useState } from 'react'
import { CheckCircle2, Facebook, Loader2, MapPin, MessageCircle, Minus, Package, Phone, Plus, ShieldCheck, ShoppingBag, Store, X } from 'lucide-react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import StarRating from '../components/product/StarRating'
import AddressFields from '../components/address/AddressFields'
import { compactCount, peso } from '../utils/format'
import { applyCampaignDiscount, getActiveCampaignDiscounts, getActiveCampaignProducts } from '../utils/campaigns'
import { getUnitPrice } from '../utils/pricing'
import { isStoreOpen } from '../utils/storeHours'
import { composeAddress, emptyAddressParts } from '../utils/address'

const REQUEST_ERROR_MESSAGES = {
  RESELLER_NOT_AVAILABLE: 'This storefront is no longer available.',
  PRODUCT_NOT_ON_STOREFRONT: 'This product is no longer listed on this storefront.',
  PRODUCT_UNAVAILABLE: 'This product is no longer available.',
  QUANTITY_BELOW_MINIMUM: 'Please order at least the minimum quantity for this product.',
  QUANTITY_EXCEEDS_STOCK: 'Only limited stock is available — please lower the quantity.',
  CUSTOMER_NAME_REQUIRED: 'Please enter your name.',
  TOO_MANY_ORDER_REQUESTS: 'Too many requests sent recently — please try again in a bit.'
}

export default function ResellerStorefront() {
  const { id, slug } = useParams()
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingProduct, setViewingProduct] = useState(null)
  const [view, setView] = useState('detail')
  const [orderForm, setOrderForm] = useState({ quantity: 1, name: '', phone: '', addressParts: emptyAddressParts(), notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [feeEstimate, setFeeEstimate] = useState(null) // { status, fee, distance_km, vehicle }
  const [estimating, setEstimating] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const storeResult = slug ? await supabase.rpc('get_reseller_storefront_by_slug', { p_slug: slug }) : await supabase.rpc('get_reseller_storefront', { p_reseller_id: id })
      const storefront = storeResult.data?.[0] || null
      if (!storefront) { setStore(null); setProducts([]); setLoading(false); return }
      const [listResult, discounts, campaignProducts] = await Promise.all([
        supabase.from('reseller_storefront_products').select('product_id,products(*,merchant_profiles(business_name,store_open_time,store_close_time,auto_pause_outside_hours,store_timezone))').eq('reseller_id', storefront.id),
        getActiveCampaignDiscounts(),
        getActiveCampaignProducts()
      ])
      const activeProducts = (listResult.data || []).map((row) => row.products).filter((product) => product?.is_active && isStoreOpen(product.merchant_profiles))
      const productIds = activeProducts.map((product) => product.id)
      // Same rating/sold-count social proof as Catalog.jsx and
      // MerchantStore.jsx — one bulk query each, not per-product. This
      // is the actual customer-facing buy page (public, no login), so
      // it's the surface where this signal matters most.
      const [reviewsResult, soldResult] = await Promise.all([
        productIds.length ? supabase.from('product_reviews').select('product_id, rating').in('product_id', productIds) : Promise.resolve({ data: [] }),
        productIds.length ? supabase.rpc('get_product_sold_counts', { p_product_ids: productIds }) : Promise.resolve({ data: [] }),
      ])
      const ratingsByProduct = {}
      for (const review of reviewsResult.data || []) {
        const bucket = (ratingsByProduct[review.product_id] ??= { sum: 0, count: 0 })
        bucket.sum += review.rating
        bucket.count += 1
      }
      const soldByProduct = Object.fromEntries((soldResult.data || []).map((row) => [row.product_id, row.sold_count]))
      setStore(storefront)
      setProducts(activeProducts.map((product) => ({
        ...applyCampaignDiscount(product, discounts, campaignProducts),
        avg_rating: ratingsByProduct[product.id] ? ratingsByProduct[product.id].sum / ratingsByProduct[product.id].count : 0,
        review_count: ratingsByProduct[product.id]?.count || 0,
        sold_count: soldByProduct[product.id] || 0,
      })))
      setLoading(false)
    })()
  }, [id, slug])

  if (loading) return <div className="grid min-h-[70vh] place-items-center bg-bg"><Spinner /></div>
  if (!store) return <div className="mx-auto min-h-[70vh] max-w-4xl p-6"><EmptyState icon={Store} title="Storefront unavailable" message="This Reseller storefront is not active." /></div>

  const digits = (value) => String(value || '').replace(/\D/g, '')
  const channels = [
    store.storefront_facebook_url && { label: 'Messenger', href: store.storefront_facebook_url, icon: Facebook },
    store.storefront_contact_number && { label: 'Call', href: `tel:${store.storefront_contact_number}`, icon: Phone },
    store.storefront_viber_number && { label: 'Viber', href: `viber://chat?number=${encodeURIComponent(store.storefront_viber_number)}`, icon: MessageCircle },
    store.storefront_whatsapp_number && { label: 'WhatsApp', href: `https://wa.me/${digits(store.storefront_whatsapp_number)}`, icon: MessageCircle }
  ].filter(Boolean)

  const openProduct = (product) => {
    setViewingProduct(product)
    setView('detail')
    setOrderForm({ quantity: product.min_order_qty || 1, name: '', phone: '', addressParts: emptyAddressParts(), notes: '' })
    setFeeEstimate(null)
  }
  const closeProduct = () => setViewingProduct(null)

  const adjustQuantity = (delta) => {
    const min = viewingProduct.min_order_qty || 1
    const max = viewingProduct.stock_quantity
    setOrderForm((prev) => ({ ...prev, quantity: Math.min(max, Math.max(min, prev.quantity + delta)) }))
  }

  const pinned = orderForm.addressParts.latitude != null && orderForm.addressParts.longitude != null

  // Live delivery-fee preview — same haversine + standard-shipping
  // formula the real checkout uses later, so what the customer sees here
  // isn't a different number than what the Reseller will actually see.
  // Debounced so dragging the map pin doesn't fire a request per frame.
  useEffect(() => {
    if (!viewingProduct || view !== 'order' || !pinned) { setFeeEstimate(null); return }
    setEstimating(true)
    const timer = setTimeout(() => {
      supabase.rpc('estimate_storefront_shipping_fee', {
        p_reseller_id: store.id,
        p_product_id: viewingProduct.id,
        p_quantity: orderForm.quantity,
        p_delivery_latitude: orderForm.addressParts.latitude,
        p_delivery_longitude: orderForm.addressParts.longitude
      }).then(({ data, error }) => {
        setFeeEstimate(error ? null : data)
        setEstimating(false)
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [store?.id, viewingProduct, view, pinned, orderForm.quantity, orderForm.addressParts.latitude, orderForm.addressParts.longitude])

  const submitOrder = async (event) => {
    event.preventDefault()
    if (!orderForm.name.trim()) return toast.error('Please enter your name.')
    if (!pinned) return toast.error('Please pin your delivery location on the map so we can show your delivery fee.')
    setSubmitting(true)
    const { error } = await supabase.rpc('submit_storefront_order_request', {
      p_reseller_id: store.id,
      p_product_id: viewingProduct.id,
      p_quantity: orderForm.quantity,
      p_customer_name: orderForm.name,
      p_customer_phone: orderForm.phone || null,
      p_customer_address: composeAddress(orderForm.addressParts) || null,
      p_customer_notes: orderForm.notes || null,
      p_customer_latitude: orderForm.addressParts.latitude,
      p_customer_longitude: orderForm.addressParts.longitude
    })
    setSubmitting(false)
    if (error) return toast.error(REQUEST_ERROR_MESSAGES[error.message] || error.message)
    setView('done')
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-teal-950 via-teal-800 to-teal-600 sm:h-72">
        {store.cover_url && <img src={store.cover_url} alt="" className="h-full w-full object-cover" />}
        <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-mango-400/20 blur-3xl" />
        <div aria-hidden className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-teal-950/80 via-teal-950/10 to-transparent" />
      </div>

      <header className="relative mx-auto -mt-16 max-w-6xl px-3 sm:-mt-20 sm:px-6">
        <div className="rounded-3xl border border-line bg-surface/95 p-5 shadow-2xl backdrop-blur sm:p-7">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:gap-6 sm:text-left">
            <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-surface bg-teal-50 shadow-xl sm:h-32 sm:w-32">
              {store.avatar_url ? <img src={store.avatar_url} alt={store.storefront_name || store.full_name} className="h-full w-full object-cover" /> : <Store size={40} className="text-teal-600" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[.18em] text-teal-600 sm:justify-start">
                <ShieldCheck size={14} /> Reseller Store
              </p>
              <h1 className="mt-1.5 break-words font-display text-2xl font-bold leading-tight text-fg sm:text-4xl">{store.storefront_name || store.full_name}</h1>
              {store.reseller_bio && <p className="mx-auto mt-3 max-w-2xl break-words text-sm leading-6 text-fg-muted sm:mx-0">{store.reseller_bio}</p>}
              <p className="mt-3 text-xs font-semibold text-fg-muted">{products.length} product{products.length === 1 ? '' : 's'} available</p>
            </div>
          </div>

          {channels.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2 border-t border-line pt-5 sm:justify-start">
              {channels.map((channel) => {
                const Icon = channel.icon
                return (
                  <a key={channel.label} href={channel.href} target={channel.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="flex items-center gap-1.5 rounded-full border border-line bg-surface-inset px-3.5 py-2 text-xs font-bold text-fg transition hover:border-teal-500/40 hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-300">
                    <Icon size={14} /> {channel.label}
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-6xl px-3 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-fg sm:text-2xl">Available products</h2>
        </div>

        {products.length === 0 ? (
          <div className="rounded-3xl border border-line bg-surface py-4">
            <EmptyState icon={Package} title="No products listed yet" message="This Reseller hasn't added any products to their storefront yet — check back soon." />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => (
              <article key={product.id} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all hover:-translate-y-1 hover:shadow-xl">
                <button type="button" onClick={() => openProduct(product)} className="block w-full text-left">
                  <div className="relative aspect-square overflow-hidden bg-surface-inset">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full place-items-center"><Package className="text-teal-300" size={32} /></div>
                    )}
                    {product.campaign_discount_percent > 0 && (
                      <span className="absolute left-0 top-2 rounded-r-md bg-coral-600 py-0.5 pl-1.5 pr-2.5 text-[10px] font-extrabold text-white shadow-sm">-{Math.round(product.campaign_discount_percent)}%</span>
                    )}
                    {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
                      <span className="absolute right-2 top-2 rounded-full bg-mango-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">Low stock</span>
                    )}
                  </div>
                  <div className="p-3 pb-0 sm:p-4 sm:pb-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400">{product.merchant_profiles?.business_name}</p>
                    <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-fg sm:text-base">{product.name}</h3>
                    {(product.review_count > 0 || product.sold_count > 0) && <div className="mt-1 flex items-center gap-1 text-[11px] text-fg-muted">
                      {product.review_count > 0 && <><StarRating value={product.avg_rating} size={10} /><span className="font-semibold">{product.avg_rating.toFixed(1)}</span></>}
                      {product.sold_count > 0 && <span className={product.review_count > 0 ? 'before:mr-1 before:content-["·"]' : ''}>{compactCount(product.sold_count)} sold</span>}
                    </div>}
                    {product.campaign_discount_percent > 0 ? (
                      <p className="mt-2 flex items-baseline gap-1.5"><span className="font-display text-base font-bold text-coral-600 sm:text-lg">₱{getUnitPrice(product, 1).toLocaleString()}</span><span className="text-xs text-fg-muted line-through">₱{Number(product.price).toLocaleString()}</span></p>
                    ) : (
                      <p className="mt-2 font-display text-base font-bold text-teal-700 dark:text-teal-300 sm:text-lg">₱{Number(product.price).toLocaleString()}</p>
                    )}
                  </div>
                </button>
                <div className="p-3 pt-3 sm:p-4">
                  <button onClick={() => openProduct(product)} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-2 py-2.5 text-xs font-bold text-white transition hover:bg-teal-700 sm:text-sm">
                    <ShoppingBag size={15} /> Order now
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <Modal open={!!viewingProduct} onClose={closeProduct} hideHeader bodyClassName="" size="md" ariaLabel={viewingProduct ? viewingProduct.name : undefined}>
        {viewingProduct && (
          <>
            <header className="relative rounded-t-3xl bg-gradient-to-br from-teal-950 to-teal-700 p-5 text-white">
              <button onClick={closeProduct} className="absolute right-4 top-4 rounded-xl bg-white/10 p-2 transition hover:bg-white/20" aria-label="Close"><X size={18} /></button>
              <p className="pr-10 text-xs font-bold uppercase tracking-wider text-mango-300">
                {view === 'order' ? 'Order this product' : view === 'done' ? 'Request sent' : 'Product details'}
              </p>
              <h2 className="mt-2 pr-10 font-display text-xl font-bold">{viewingProduct.name}</h2>
            </header>

            {view === 'detail' && (
              <div className="p-5">
                <div className="aspect-video overflow-hidden rounded-2xl bg-surface-inset">
                  {viewingProduct.images?.[0] ? <img src={viewingProduct.images[0]} alt={viewingProduct.name} className="h-full w-full object-cover" /> : <Package className="m-auto h-full text-teal-300" />}
                </div>
                <p className="mt-4 font-display text-2xl font-bold text-teal-700 dark:text-teal-300">₱{Number(viewingProduct.price).toLocaleString()}</p>
                <p className="text-xs text-fg-muted">{viewingProduct.merchant_profiles?.business_name}</p>
                {(viewingProduct.review_count > 0 || viewingProduct.sold_count > 0) && <div className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-muted">
                  {viewingProduct.review_count > 0 && <><StarRating value={viewingProduct.avg_rating} size={13} /><span className="font-semibold">{viewingProduct.avg_rating.toFixed(1)} ({viewingProduct.review_count})</span></>}
                  {viewingProduct.sold_count > 0 && <span>{viewingProduct.review_count > 0 ? '· ' : ''}{compactCount(viewingProduct.sold_count)} sold</span>}
                </div>}
                {viewingProduct.description && <p className="mt-3 text-sm leading-6 text-fg-muted">{viewingProduct.description}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge bg-teal-500/10 text-teal-700 dark:text-teal-300">Min order: {viewingProduct.min_order_qty || 1}</span>
                  <span className="badge bg-mango-500/10 text-mango-700 dark:text-mango-300">{viewingProduct.stock_quantity} in stock</span>
                </div>
                <button onClick={() => setView('order')} className="btn-primary mt-5 flex w-full items-center justify-center gap-2"><ShoppingBag size={16} /> Order this product</button>
                {channels.length > 0 && (
                  <div className="mt-5 border-t border-line pt-4">
                    <h3 className="break-words text-sm font-bold text-fg">Prefer to contact {store.storefront_name} directly?</h3>
                    <div className="mt-2 grid gap-2">
                      {channels.map((channel) => {
                        const Icon = channel.icon
                        return <a key={channel.label} href={channel.href} target={channel.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-inset py-2.5 text-sm font-semibold text-fg transition hover:border-teal-500/40 hover:text-teal-700 dark:hover:text-teal-300"><Icon size={16} />{channel.label}</a>
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {view === 'order' && (
              <form onSubmit={submitOrder} className="space-y-4 p-5">
                <button type="button" onClick={() => setView('detail')} className="text-xs font-semibold text-teal-700 dark:text-teal-300">&larr; Back to details</button>
                <div>
                  <label className="text-sm font-semibold text-fg-muted">Quantity</label>
                  <div className="mt-1.5 flex w-fit items-center rounded-xl border border-line">
                    <button type="button" onClick={() => adjustQuantity(-1)} className="p-2.5 hover:bg-teal-500/10" aria-label="Decrease quantity"><Minus size={14} /></button>
                    <span className="w-10 text-center text-sm font-semibold text-fg">{orderForm.quantity}</span>
                    <button type="button" onClick={() => adjustQuantity(1)} className="p-2.5 hover:bg-teal-500/10" aria-label="Increase quantity"><Plus size={14} /></button>
                  </div>
                  <p className="mt-1 text-[11px] text-fg-muted">Min {viewingProduct.min_order_qty || 1} · {viewingProduct.stock_quantity} in stock</p>
                </div>
                <label className="block text-sm font-semibold text-fg-muted">Your name *
                  <input required maxLength={200} value={orderForm.name} onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })} className="input-field mt-1.5" placeholder="Juan Dela Cruz" />
                </label>
                <label className="block text-sm font-semibold text-fg-muted">Phone number
                  <input type="tel" maxLength={30} value={orderForm.phone} onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })} className="input-field mt-1.5" placeholder="+63 912 345 6789" />
                </label>
                <div>
                  <label className="text-sm font-semibold text-fg-muted">Delivery address *</label>
                  <div className="mt-1.5">
                    <AddressFields value={orderForm.addressParts} onChange={(addressParts) => setOrderForm({ ...orderForm, addressParts })} required withCoordinates />
                  </div>
                  {!pinned && <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-coral-600 dark:text-coral-300"><MapPin size={12} /> Pin your exact location above to see your delivery fee and send this request.</p>}
                </div>
                {pinned && (
                  <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-3 text-sm">
                    {estimating ? (
                      <span className="flex items-center gap-2 text-fg-muted"><Loader2 size={14} className="animate-spin" /> Estimating delivery fee…</span>
                    ) : feeEstimate?.status === 'calculated' ? (
                      <p className="font-semibold text-teal-700 dark:text-teal-300">Estimated delivery fee: {peso(feeEstimate.fee)} <span className="font-normal text-fg-muted">({Number(feeEstimate.distance_km).toFixed(1)} km, {feeEstimate.vehicle})</span></p>
                    ) : (
                      <p className="text-fg-muted">Delivery fee will be confirmed by the seller after you send this request.</p>
                    )}
                  </div>
                )}
                <label className="block text-sm font-semibold text-fg-muted">Note (optional)
                  <textarea maxLength={500} rows={2} value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} className="input-field mt-1.5 resize-none" placeholder="Preferred delivery time, color/variant, etc." />
                </label>
                <p className="flex gap-2 rounded-xl bg-coral-500/10 p-3 text-xs leading-5 text-coral-700 dark:text-coral-300"><ShieldCheck size={16} className="mt-0.5 shrink-0" />Never share your email OTP, password, banking OTP, or recovery code. The Reseller will contact you to confirm final price, delivery, and payment.</p>
                <button disabled={submitting || !pinned} className="btn-primary flex w-full items-center justify-center gap-2">
                  {submitting && <Loader2 size={16} className="animate-spin" />}{submitting ? 'Sending…' : 'Send order request'}
                </button>
              </form>
            )}

            {view === 'done' && (
              <div className="p-5 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-300"><CheckCircle2 size={28} /></span>
                <p className="mt-4 text-sm leading-6 text-fg-muted">Your order request was sent to <strong className="text-fg">{store.storefront_name}</strong>. They&apos;ll contact you{orderForm.phone ? ` at ${orderForm.phone}` : ''} to confirm the details.</p>
                <button onClick={closeProduct} className="btn-primary mt-5 w-full">Done</button>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
