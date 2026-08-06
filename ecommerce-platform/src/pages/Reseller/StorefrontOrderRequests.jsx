import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Check, Package, RefreshCw, Send, ShoppingBag, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { peso, formatDate } from '../../utils/format'
import { getSuggestedCustomerPrice } from '../../utils/pricing'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Tabs from '../../components/ui/Tabs'
import Modal from '../../components/ui/Modal'
import { markPendingConversion } from '../../utils/storefrontRequestConversion'

const STATUS_STYLES = {
  pending: 'bg-mango-100 text-mango-600 dark:bg-mango-500/15 dark:text-mango-300',
  accepted: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  declined: 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-300',
  converted: 'bg-teal-500/15 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200'
}

// Mirrors trg_require_complete_customer_address (shipping_engine_migration.sql):
// >=25 chars, contains a digit, and at least 4 comma-separated parts.
const CUSTOMERS_ADDRESS_FORMAT = /^[^,]+,[^,]+,[^,]+,[^,]+/
const isAddressDbCompatible = (address) => {
  const trimmed = (address || '').trim()
  return trimmed.length >= 25 && /\d/.test(trimmed) && CUSTOMERS_ADDRESS_FORMAT.test(trimmed)
}

export default function StorefrontOrderRequests() {
  const { user } = useAuth()
  const { addItem } = useCart()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [detail, setDetail] = useState(null)
  const [convertingId, setConvertingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('storefront_order_requests')
      .select('*, products(id,name,images,price,stock_quantity,min_order_qty)')
      .eq('reseller_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setRequests(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const respond = async (request, status) => {
    const note = status === 'declined' ? (window.prompt('Reason for declining this request (optional):') || '') : ''
    const { error } = await supabase
      .from('storefront_order_requests')
      .update({ status, reseller_response_note: note || null, responded_at: new Date().toISOString() })
      .eq('id', request.id)
    if (error) return toast.error(error.message)
    toast.success(status === 'accepted' ? 'Request accepted.' : 'Request declined.')
    setDetail(null)
    load()
  }

  const handleConvert = async (request) => {
    setConvertingId(request.id)
    try {
      // Re-fetch the full product row rather than reusing the narrow
      // list-view join — addItem() needs every field it stores on a cart
      // line (merchant_id, packed dimensions, discount tiers, etc.), and
      // this also re-confirms the product still exists.
      const { data: product, error: productError } = await supabase.from('products').select('*').eq('id', request.product_id).maybeSingle()
      if (productError) throw productError
      if (!product) return toast.error('This product is no longer available.')

      let customer = null
      if (request.customer_phone) {
        const { data } = await supabase.from('customers').select('*').eq('reseller_id', user.id).eq('phone', request.customer_phone).maybeSingle()
        customer = data || null
      }
      if (!customer) {
        // customers.address is DB-validated (trg_require_complete_customer_address:
        // >=25 chars, a digit, and 4 comma-separated parts) to match the structured
        // AddressFields format used everywhere else a customer is saved. A
        // storefront request's address is a single free-text field a customer
        // typed themselves and will rarely match that shape, so only carry it
        // over when it already qualifies -- otherwise keep it in notes (it's
        // still visible on the original request either way) and let the
        // Reseller fill in a proper address at checkout, same as today.
        const addressQualifies = isAddressDbCompatible(request.customer_address)
        const notesWithFallbackAddress = addressQualifies || !request.customer_address
          ? request.customer_notes
          : [request.customer_notes, `Address from storefront request: ${request.customer_address}`].filter(Boolean).join('\n')
        const { data: created, error: createError } = await supabase
          .from('customers')
          .insert({
            reseller_id: user.id,
            name: request.customer_name,
            phone: request.customer_phone,
            address: addressQualifies ? request.customer_address : null,
            notes: notesWithFallbackAddress
          })
          .select()
          .single()
        if (createError) throw createError
        customer = created
      }
      addItem(product, request.quantity, customer, getSuggestedCustomerPrice(product))
      markPendingConversion(`${product.id}:${customer.id}`, request.id)
      toast.success('Added to your cart — finish checkout to convert this request into an order.')
      setDetail(null)
      navigate('/reseller/cart')
    } catch (err) {
      toast.error(err.message || 'Unable to convert this request.')
    } finally {
      setConvertingId(null)
    }
  }

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Storefront</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">Customer Orders</h1>
          <p className="mt-1 text-sm text-ink/50">Order requests customers sent directly from your storefront.</p>
        </div>
        <button onClick={load} className="btn-secondary p-2.5" aria-label="Refresh requests">
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <Tabs options={['pending', 'accepted', 'declined', 'converted', 'all']} value={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState icon={Send} title="No requests here" message="No customer order requests match this filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => (
            <button key={request.id} type="button" onClick={() => setDetail(request)} className="card block w-full p-5 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-teal-50">
                    {request.products?.images?.[0] ? <img src={request.products.images[0]} alt="" className="h-full w-full object-cover" /> : <Package size={18} className="text-teal-300" />}
                  </div>
                  <div>
                    <p className="font-semibold text-ink">{request.customer_name}<span className="ml-1.5 font-normal text-ink/40">· {request.customer_phone || 'no phone'}</span></p>
                    <p className="mt-1 text-sm text-ink/60">{request.products?.name || 'Product removed'} × {request.quantity}</p>
                    <p className="mt-1 text-xs text-ink/40">Requested {formatDate(request.created_at)}</p>
                  </div>
                </div>
                <span className={`badge capitalize ${STATUS_STYLES[request.status] || 'bg-ink/10 text-ink/60'}`}>{request.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.customer_name} subtitle={detail?.products?.name || 'Product removed'} icon={UserRound} size="md">
        {detail && (
          <>
            <div className="mb-4"><span className={`badge capitalize ${STATUS_STYLES[detail.status] || 'bg-ink/10 text-ink/60'}`}>{detail.status}</span></div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Customer</p>
                <p className="mt-1 text-ink">{detail.customer_name}</p>
                <p className="text-ink/60">{detail.customer_phone || 'No phone given'}</p>
                <p className="text-ink/60">{detail.customer_address || 'No address given'}</p>
              </div>
              {detail.customer_notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Note from customer</p>
                  <p className="mt-1 text-ink/70">{detail.customer_notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Product</p>
                <p className="mt-1 text-ink">{detail.products?.name || 'Product no longer available'} × {detail.quantity}</p>
                {detail.products?.price != null && <p className="text-ink/60">{peso(detail.products.price)} each · buying price</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Requested</p>
                <p className="mt-1 text-ink/70">{formatDate(detail.created_at)}</p>
              </div>
              {detail.reseller_response_note && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Your note</p>
                  <p className="mt-1 text-ink/70">{detail.reseller_response_note}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {detail.status === 'pending' && (
                <>
                  <button onClick={() => respond(detail, 'accepted')} className="btn-primary flex items-center gap-1.5 text-sm"><Check size={15} /> Accept</button>
                  <button onClick={() => respond(detail, 'declined')} className="flex items-center gap-1.5 rounded-xl bg-coral-100 px-4 py-2.5 text-sm font-semibold text-coral-700"><Ban size={15} /> Decline</button>
                </>
              )}
              {detail.status === 'accepted' && (
                <button onClick={() => handleConvert(detail)} disabled={convertingId === detail.id} className="btn-primary flex items-center gap-1.5 text-sm">
                  <ShoppingBag size={15} /> {convertingId === detail.id ? 'Adding to cart…' : 'Convert to order'}
                </button>
              )}
              {detail.status === 'converted' && <p className="text-sm font-semibold text-teal-700">This request has already been converted into an order.</p>}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
