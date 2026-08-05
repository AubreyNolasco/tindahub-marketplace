import { useEffect, useState } from 'react'
import { CheckCircle2, Facebook, Loader2, MessageCircle, Minus, Package, Phone, Plus, ShieldCheck, ShoppingBag, Store, X } from 'lucide-react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { applyCampaignDiscount, getActiveCampaignDiscounts } from '../utils/campaigns'
import { isStoreOpen } from '../utils/storeHours'

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
  const [orderForm, setOrderForm] = useState({ quantity: 1, name: '', phone: '', address: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const storeResult = slug ? await supabase.rpc('get_reseller_storefront_by_slug', { p_slug: slug }) : await supabase.rpc('get_reseller_storefront', { p_reseller_id: id })
      const storefront = storeResult.data?.[0] || null
      if (!storefront) { setStore(null); setProducts([]); setLoading(false); return }
      const [listResult, discounts] = await Promise.all([
        supabase.from('reseller_storefront_products').select('product_id,products(*,merchant_profiles(business_name,store_open_time,store_close_time,auto_pause_outside_hours,store_timezone))').eq('reseller_id', storefront.id),
        getActiveCampaignDiscounts()
      ])
      setStore(storefront)
      setProducts((listResult.data || []).map((row) => row.products).filter((product) => product?.is_active && isStoreOpen(product.merchant_profiles)).map((product) => applyCampaignDiscount(product, discounts)))
      setLoading(false)
    })()
  }, [id, slug])

  if (loading) return <div className="py-24"><Spinner /></div>
  if (!store) return <div className="mx-auto max-w-4xl p-6"><EmptyState icon={Store} title="Storefront unavailable" message="This Reseller storefront is not active." /></div>

  const digits = (value) => String(value || '').replace(/\D/g, '')
  const channels = [
    store.storefront_facebook_url && { label: 'Facebook / Messenger', href: store.storefront_facebook_url, icon: Facebook },
    store.storefront_contact_number && { label: `Call ${store.storefront_contact_number}`, href: `tel:${store.storefront_contact_number}`, icon: Phone },
    store.storefront_viber_number && { label: 'Open Viber', href: `viber://chat?number=${encodeURIComponent(store.storefront_viber_number)}`, icon: MessageCircle },
    store.storefront_whatsapp_number && { label: 'Open WhatsApp', href: `https://wa.me/${digits(store.storefront_whatsapp_number)}`, icon: MessageCircle }
  ].filter(Boolean)

  const openProduct = (product) => {
    setViewingProduct(product)
    setView('detail')
    setOrderForm({ quantity: product.min_order_qty || 1, name: '', phone: '', address: '', notes: '' })
  }
  const closeProduct = () => setViewingProduct(null)

  const adjustQuantity = (delta) => {
    const min = viewingProduct.min_order_qty || 1
    const max = viewingProduct.stock_quantity
    setOrderForm((prev) => ({ ...prev, quantity: Math.min(max, Math.max(min, prev.quantity + delta)) }))
  }

  const submitOrder = async (event) => {
    event.preventDefault()
    if (!orderForm.name.trim()) return toast.error('Please enter your name.')
    setSubmitting(true)
    const { error } = await supabase.rpc('submit_storefront_order_request', {
      p_reseller_id: store.id,
      p_product_id: viewingProduct.id,
      p_quantity: orderForm.quantity,
      p_customer_name: orderForm.name,
      p_customer_phone: orderForm.phone || null,
      p_customer_address: orderForm.address || null,
      p_customer_notes: orderForm.notes || null
    })
    setSubmitting(false)
    if (error) return toast.error(REQUEST_ERROR_MESSAGES[error.message] || error.message)
    setView('done')
  }

  return (
    <div className="min-h-screen bg-bg pb-12">
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-teal-950 to-teal-600 sm:h-64">
        {store.cover_url && <img src={store.cover_url} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-teal-950/75 to-transparent" />
      </div>
      <header className="relative mx-auto -mt-12 max-w-7xl px-3 sm:-mt-14 sm:px-6">
        <div className="rounded-3xl border border-black/[.06] bg-surface p-4 shadow-soft sm:flex sm:items-end sm:gap-5 sm:p-5">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-teal-50 shadow-xl sm:h-28 sm:w-28">
            {store.avatar_url ? <img src={store.avatar_url} alt={store.storefront_name || store.full_name} className="h-full w-full object-cover" /> : <Store size={36} className="text-teal-600" />}
          </div>
          <div className="mt-3 min-w-0 flex-1 sm:mt-0 sm:pb-2">
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-teal-600 sm:text-xs sm:tracking-[.16em]">Reseller Store</p>
            <h1 className="mt-1 break-words font-display text-2xl font-bold leading-tight sm:text-3xl">{store.storefront_name || store.full_name}</h1>
            {store.reseller_bio && <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-ink/60">{store.reseller_bio}</p>}
          </div>
        </div>
      </header>
      <main className="mx-auto mt-8 max-w-7xl px-2 sm:px-6">
        <div className="mb-4 px-2 sm:px-0">
          <h2 className="font-display text-xl font-bold">Available products</h2>
          <p className="mt-1 text-sm text-ink/45">{products.length} product{products.length === 1 ? '' : 's'} selected by this Reseller</p>
        </div>
        {products.length === 0 ? <EmptyState icon={Package} title="No products listed yet" /> : (
          <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4 sm:gap-4">
            {products.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-xl border border-black/[.06] bg-surface shadow-card sm:rounded-2xl">
                <button type="button" onClick={() => openProduct(product)} className="block w-full text-left">
                  <div className="aspect-square bg-teal-50">
                    {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" /> : <Package className="m-auto h-full text-teal-300" />}
                  </div>
                  <div className="p-2 pb-0 sm:p-4 sm:pb-0">
                    <p className="truncate text-[8px] font-bold uppercase text-teal-700 sm:text-xs">{product.merchant_profiles?.business_name}</p>
                    <h3 className="mt-1 line-clamp-2 min-h-8 text-[10px] font-semibold sm:min-h-10 sm:text-sm">{product.name}</h3>
                    <p className="mt-2 font-display text-xs font-bold text-teal-700 sm:text-lg">₱{Number(product.price).toLocaleString()}</p>
                  </div>
                </button>
                <div className="p-2 pt-2 sm:p-4 sm:pt-3">
                  <button onClick={() => openProduct(product)} className="flex w-full items-center justify-center gap-1 rounded-lg bg-teal-600 px-2 py-2 text-[9px] font-bold text-white sm:gap-2 sm:rounded-xl sm:text-sm"><ShoppingBag size={14} /> View &amp; Order</button>
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
              <button onClick={closeProduct} className="absolute right-4 top-4 rounded-xl bg-white/10 p-2" aria-label="Close"><X size={18} /></button>
              <p className="pr-10 text-xs font-bold uppercase tracking-wider text-mango-300">
                {view === 'order' ? 'Order this product' : view === 'done' ? 'Request sent' : 'Product details'}
              </p>
              <h2 className="mt-2 pr-10 font-display text-xl font-bold">{viewingProduct.name}</h2>
            </header>

            {view === 'detail' && (
              <div className="p-5">
                <div className="aspect-video overflow-hidden rounded-2xl bg-teal-50">
                  {viewingProduct.images?.[0] ? <img src={viewingProduct.images[0]} alt={viewingProduct.name} className="h-full w-full object-cover" /> : <Package className="m-auto h-full text-teal-300" />}
                </div>
                <p className="mt-4 font-display text-2xl font-bold text-teal-700">₱{Number(viewingProduct.price).toLocaleString()}</p>
                <p className="text-xs text-ink/45">{viewingProduct.merchant_profiles?.business_name}</p>
                {viewingProduct.description && <p className="mt-3 text-sm leading-6 text-ink/65">{viewingProduct.description}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge bg-teal-50 text-teal-700">Min order: {viewingProduct.min_order_qty || 1}</span>
                  <span className="badge bg-mango-100 text-mango-700">{viewingProduct.stock_quantity} in stock</span>
                </div>
                <button onClick={() => setView('order')} className="btn-primary mt-5 flex w-full items-center justify-center gap-2"><ShoppingBag size={16} /> Order this product</button>
                <div className="mt-5">
                  <h3 className="break-words text-sm font-bold text-ink">Prefer to contact {store.storefront_name} directly?</h3>
                  {channels.length ? (
                    <div className="mt-2 grid gap-2">
                      {channels.map((channel) => {
                        const Icon = channel.icon
                        return <a key={channel.label} href={channel.href} target={channel.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm"><Icon size={16} />{channel.label}</a>
                      })}
                    </div>
                  ) : <p className="mt-2 text-xs text-ink/45">No direct contact channel published — use the order button above.</p>}
                </div>
              </div>
            )}

            {view === 'order' && (
              <form onSubmit={submitOrder} className="space-y-4 p-5">
                <button type="button" onClick={() => setView('detail')} className="text-xs font-semibold text-teal-700">&larr; Back to details</button>
                <div>
                  <label className="text-sm font-semibold text-ink/70">Quantity</label>
                  <div className="mt-1.5 flex w-fit items-center rounded-xl border border-black/10">
                    <button type="button" onClick={() => adjustQuantity(-1)} className="p-2.5 hover:bg-teal-50" aria-label="Decrease quantity"><Minus size={14} /></button>
                    <span className="w-10 text-center text-sm font-semibold">{orderForm.quantity}</span>
                    <button type="button" onClick={() => adjustQuantity(1)} className="p-2.5 hover:bg-teal-50" aria-label="Increase quantity"><Plus size={14} /></button>
                  </div>
                  <p className="mt-1 text-[11px] text-ink/40">Min {viewingProduct.min_order_qty || 1} · {viewingProduct.stock_quantity} in stock</p>
                </div>
                <label className="block text-sm font-semibold text-ink/70">Your name *
                  <input required maxLength={200} value={orderForm.name} onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })} className="input-field mt-1.5" placeholder="Juan Dela Cruz" />
                </label>
                <label className="block text-sm font-semibold text-ink/70">Phone number
                  <input type="tel" maxLength={30} value={orderForm.phone} onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })} className="input-field mt-1.5" placeholder="+63 912 345 6789" />
                </label>
                <label className="block text-sm font-semibold text-ink/70">Delivery address
                  <textarea maxLength={500} rows={2} value={orderForm.address} onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })} className="input-field mt-1.5 resize-none" placeholder="House/unit, street, barangay, city" />
                </label>
                <label className="block text-sm font-semibold text-ink/70">Note (optional)
                  <textarea maxLength={500} rows={2} value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} className="input-field mt-1.5 resize-none" placeholder="Preferred delivery time, color/variant, etc." />
                </label>
                <p className="flex gap-2 rounded-xl bg-coral-100 p-3 text-xs leading-5 text-coral-700"><ShieldCheck size={16} className="mt-0.5 shrink-0" />Never share your email OTP, password, banking OTP, or recovery code. The Reseller will contact you to confirm final price, delivery, and payment.</p>
                <button disabled={submitting} className="btn-primary flex w-full items-center justify-center gap-2">
                  {submitting && <Loader2 size={16} className="animate-spin" />}{submitting ? 'Sending…' : 'Send order request'}
                </button>
              </form>
            )}

            {view === 'done' && (
              <div className="p-5 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-100 text-teal-700"><CheckCircle2 size={28} /></span>
                <p className="mt-4 text-sm leading-6 text-ink/65">Your order request was sent to <strong>{store.storefront_name}</strong>. They&apos;ll contact you{orderForm.phone ? ` at ${orderForm.phone}` : ''} to confirm the details.</p>
                <button onClick={closeProduct} className="btn-primary mt-5 w-full">Done</button>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
