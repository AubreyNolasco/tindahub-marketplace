import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Loader2, Wallet, ShoppingBag, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { peso } from '../../utils/format'
import { getSuggestedCustomerPrice, getUnitPrice, getResellerUnitPrice } from '../../utils/pricing'
import EmptyState from '../../components/ui/EmptyState'
import { composeAddress, isCompleteAddress, partsFromLegacyAddress } from '../../utils/address'
import AddressFields from '../../components/address/AddressFields'
import { resolvePsgcCodes } from '../../lib/services/psgc'
import Modal from '../../components/ui/Modal'

const ERROR_MESSAGES = {
  STORE_CLOSED: 'The Merchant store is currently closed. Try again during its published store hours.',
  INSUFFICIENT_BALANCE: 'Your wallet balance is insufficient for this order.',
  INSUFFICIENT_STOCK: 'An item is out of stock. Please refresh your cart.',
  BELOW_MIN_ORDER_QTY: 'An item does not meet the minimum order quantity.',
  PRODUCT_UNAVAILABLE: 'An item is no longer available. Please refresh your cart.',
  EMPTY_CART: 'There are no items in this cart.',
  NO_WALLET: 'No wallet was found for your account. Refresh the page or contact support.'
}

export default function Checkout() {
  const { merchantId } = useParams()
  const navigate = useNavigate()
  const { user, role, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const customerId = searchParams.get('customer')
  const { groupedOrders, clearOrderItems } = useCart()
  const group = groupedOrders[`${merchantId}__${customerId || 'self'}`]
  const items = useMemo(() => group?.items || [], [group])

  const [merchant, setMerchant] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [addressParts, setAddressParts] = useState(partsFromLegacyAddress(group?.customerAddress || ''))
  const address = composeAddress(addressParts)
  const [submitting, setSubmitting] = useState(false)
  const [shippingGuideOpen, setShippingGuideOpen] = useState(false)
  const [shippingAccepted, setShippingAccepted] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  useEffect(() => {
    if (merchantId) loadMerchant()
    loadWallet()
  }, [merchantId, loadMerchant, loadWallet])
  useEffect(() => {
    if (customerId || !profile?.address) return
    const hasStructured = profile.street || profile.barangay || profile.city || profile.province || profile.postal_code
    if (!hasStructured) { setAddressParts(partsFromLegacyAddress(profile.address)); return }
    const loaded = { street: profile.street || '', barangay: profile.barangay || '', city: profile.city || '', province: profile.province || '', postalCode: profile.postal_code || '', latitude: null, longitude: null, provinceCode: null, cityCode: null }
    setAddressParts(loaded)
    resolvePsgcCodes(loaded.province, loaded.city).then(({ provinceCode, cityCode }) => {
      setAddressParts((current) => (current.province === loaded.province && current.city === loaded.city ? { ...current, provinceCode, cityCode } : current))
    }).catch(() => {})
  }, [customerId, profile])

  useEffect(() => {
    if (!merchantId || items.length === 0) return
    let active = true
    setQuoteLoading(true)
    supabase.rpc('quote_order', { p_merchant_id: merchantId, p_items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })), p_shipping_fee: 0 })
      .then(({ data, error }) => { if (!active) return; if (error) { setQuote(null); toast.error(`Unable to verify checkout price: ${error.message}`) } else setQuote(data); setQuoteLoading(false) })
    return () => { active = false }
  }, [merchantId, items])

  const loadMerchant = useCallback(async () => {
    const { data, error } = await supabase
      .from('merchant_profiles')
      .select('id, business_name')
      .eq('id', merchantId)
      .maybeSingle()
    if (error) toast.error(error.message)
    setMerchant(data)
  }, [merchantId])

  const loadWallet = useCallback(async () => {
    const { data, error } = await supabase.from('wallets').select('balance').eq('owner_id', user.id).maybeSingle()
    if (error) toast.error(error.message)
    setWallet(data)
  }, [user])

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={ShoppingBag}
          title="No Items to Check Out"
          message="Your cart for this merchant may already have been checked out or cleared."
          action={<Link to="/catalog" className="btn-primary">Back to Catalog</Link>}
        />
      </div>
    )
  }

  const itemPrice = (item) => role === 'reseller' ? getResellerUnitPrice(item, item.quantity) : getUnitPrice(item, item.quantity)
  const localSubtotal = items.reduce((s, i) => s + itemPrice(i) * i.quantity, 0)
  const subtotal = quote ? Number(quote.subtotal) : localSubtotal
  const resellerOperationFee = quote ? Number(quote.reseller_fee) : role === 'reseller' ? Math.max(3, Math.min(50, Math.round(localSubtotal * 0.01 * 100) / 100)) : 0
  const total = quote ? Number(quote.total) : subtotal + resellerOperationFee
  const customerRevenue = role === 'reseller' ? items.reduce((sum, item) => sum + Number(item.customer_selling_price ?? getSuggestedCustomerPrice(item)) * item.quantity, 0) : 0
  const estimatedProfit = customerRevenue - subtotal - resellerOperationFee
  const balance = wallet?.balance || 0
  const insufficientBalance = balance < total
  const validateOrder = () => {
    const accountAddress = role === 'merchant' ? profile?.merchant_profiles?.business_address : profile?.address
    if (!isCompleteAddress(accountAddress)) { toast.error('Complete your account address before ordering.'); navigate(role === 'merchant' ? '/merchant/address' : '/reseller/address'); return false }
    if (!isCompleteAddress(address)) { toast.error('A complete shipping address is required.'); return false }
    if (quoteLoading || !quote) { toast.error('Please wait for the secure price verification.'); return false }
    if (insufficientBalance) { toast.error(ERROR_MESSAGES.INSUFFICIENT_BALANCE); return false }
    return true
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validateOrder()) return
    if (role === 'reseller') { setShippingAccepted(false); setShippingGuideOpen(true) }
    else placeOrder()
  }

  const placeOrder = async () => {
    if (!validateOrder()) return
    setShippingGuideOpen(false)
    setSubmitting(true)
    try {
      const rpc = customerId ? 'place_customer_receiver_shipping_order' : 'place_receiver_shipping_order'
      const params = customerId ? {
        p_merchant_id: merchantId, p_customer_id: customerId, p_shipping_address: address,
        p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }))
      } : {
        p_merchant_id: merchantId, p_shipping_address: address,
        p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }))
      }
      const { error } = await supabase.rpc(rpc, params)

      if (error) throw error

      clearOrderItems(merchantId, customerId)
      toast.success('Order placed! Product and system fees were charged to your wallet. Shipping will be paid upon delivery.')
      navigate(role === 'merchant' ? '/merchant/purchases' : '/reseller/orders')
    } catch (err) {
      toast.error(ERROR_MESSAGES[err.message] || err.message || 'An error occurred during checkout.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-1">Checkout</h1>
      <p className="text-ink/60 text-sm mb-6">Order from {merchant?.business_name || '...'}</p>

      {customerId && <div className="card mb-5 border-teal-100 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-500/10"><p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Order customer</p><p className="mt-1 font-semibold text-ink">{group?.customerName}</p><p className="text-sm text-ink/55">{group?.customerPhone || 'No phone number'} · {group?.customerAddress}</p></div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {items.map((i) => (
              <div key={i.product_id} className="flex justify-between text-ink/70">
                <span>{i.name} × {i.quantity}</span>
                <span>{peso(itemPrice(i) * i.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-black/5 pt-2 text-ink/60"><span>Shipping fee</span><span className="font-semibold text-mango-600">Pay upon delivery</span></div>
            {resellerOperationFee > 0 && <div className="flex justify-between text-ink/60"><span>{quote?.reseller_fee_percent || 1}% Reseller System Fee</span><span>{peso(resellerOperationFee)}</span></div>}
            <div className="flex justify-between border-t border-black/5 pt-3 font-display text-lg font-bold text-ink"><span>Final amount to pay</span><span className="text-teal-700">{peso(total)}</span></div>
          </div>
          {resellerOperationFee > 0 && <p className="mt-3 text-xs leading-5 text-ink/50">Server-verified wholesale amount plus the system fee will be charged. The fee is capped from {peso(quote?.reseller_fee_minimum || 3)} to {peso(quote?.reseller_fee_maximum || 50)} per order. Earnings are not guaranteed.</p>}
          {role === 'reseller' && <div className={`mt-4 grid grid-cols-2 gap-3 rounded-xl p-4 ${estimatedProfit > 0 ? 'bg-mango-100/60 dark:bg-mango-500/10' : 'bg-coral-50 dark:bg-coral-500/10'}`}><div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Your customer will pay</p><p className="mt-1 font-display text-lg font-bold text-ink">{peso(customerRevenue)}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Estimated Reseller profit</p><p className={`mt-1 font-display text-lg font-bold ${estimatedProfit > 0 ? 'text-teal-700' : 'text-coral-600'}`}>{peso(estimatedProfit)}</p></div><p className="col-span-2 text-[10px] leading-4 text-ink/45">Cart estimate after the JOM HUB system fee, before delivery, marketing, returns, and taxes. The customer selling price is not charged by JOM HUB.</p></div>}
          <p className={`mt-2 text-xs font-semibold ${quote ? 'text-teal-700' : 'text-mango-700'}`}>{quoteLoading ? 'Verifying the latest secure price…' : quote ? 'Price verified by the secure checkout server.' : 'Price verification unavailable.'}</p>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Shipping Address</h2>
          <AddressFields value={addressParts} onChange={setAddressParts} required />
        </div>

        <div className="card border-mango-300 bg-mango-100/50 p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-mango-600"><Truck size={19} /></span><div><h2 className="font-semibold text-ink">Shipping fee is paid upon delivery</h2><p className="mt-1 text-sm leading-6 text-ink/60">The reseller or final recipient will pay the actual delivery fee directly to the rider or delivery provider when the products arrive. This fee is not included in the JOM HUB wallet payment.</p></div></div></div>

        <div className={`card p-5 ${insufficientBalance ? 'bg-coral-100' : 'bg-teal-500 text-white'}`}>
          <div className={`flex items-center gap-2 mb-1 text-sm ${insufficientBalance ? 'text-coral-600' : 'text-teal-100'}`}>
            <Wallet size={18} /> Wallet Balance
          </div>
          <p className={`font-display font-bold text-2xl ${insufficientBalance ? 'text-coral-600' : ''}`}>{peso(balance)}</p>
          {insufficientBalance && (
            <p className="text-sm text-coral-600 mt-2">
              Your balance is insufficient for this order ({peso(total)}).{' '}
              <Link to={role === 'merchant' ? '/merchant/wallet' : '/reseller/wallet'} className="font-semibold underline">
                Top up your wallet
              </Link>
              .
            </p>
          )}
        </div>

        {role === 'reseller' && profile?.account_status !== 'approved' && <p className="text-xs font-semibold text-coral-600">Placing orders is locked until Admin approves your ID verification and initial wallet top-up.</p>}
        <button type="submit" disabled={submitting || insufficientBalance || quoteLoading || !quote || (role === 'reseller' && profile?.account_status !== 'approved')} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? 'Submitting...' : `Pay & Place Order — ${peso(total)}`}
        </button>
      </form>
      <Modal open={shippingGuideOpen} onClose={() => setShippingGuideOpen(false)} size="sm" hideHeader bodyClassName="" ariaLabel="Shipping payment reminder">
        <div className="bg-gradient-to-br from-mango-500 to-mango-600 px-6 py-7 text-ink">
          <div className="flex items-start justify-between">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/80 shadow-sm"><Truck size={28} /></span>
            <button type="button" onClick={() => setShippingGuideOpen(false)} className="rounded-xl bg-white/30 px-3 py-2 text-xl leading-none hover:bg-white/50" aria-label="Close shipping guide">×</button>
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold">Important shipping reminder</h2>
        </div>
        <div className="p-6">
          <p className="text-sm leading-7 text-ink/65">The shipping fee is <strong className="text-ink">not included</strong> in the {peso(total)} JOM HUB wallet payment.</p>
          <div className="mt-4 rounded-2xl border border-mango-300 bg-mango-100/50 p-4 dark:border-mango-700 dark:bg-mango-500/10">
            <p className="font-semibold text-ink">Who pays the shipping fee?</p>
            <p className="mt-2 text-sm leading-6 text-ink/60">The reseller or selected customer must pay the actual shipping fee directly to the rider or delivery provider when the item arrives.</p>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-teal-50 p-3 text-sm leading-5 text-teal-800">
            <input type="checkbox" checked={shippingAccepted} onChange={(event) => setShippingAccepted(event.target.checked)} className="mt-1 accent-teal-600" /> I understand that shipping is paid separately upon delivery.
          </label>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setShippingGuideOpen(false)} className="btn-secondary flex-1">Go back</button>
            <button type="button" disabled={!shippingAccepted || submitting} onClick={placeOrder} className="btn-primary flex-1">{submitting ? 'Placing...' : 'Confirm order'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
