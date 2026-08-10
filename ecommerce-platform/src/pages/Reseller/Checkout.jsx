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
import { takePendingConversions } from '../../utils/storefrontRequestConversion'

const ERROR_MESSAGES = {
  STORE_CLOSED: 'The Merchant store is currently closed. Try again during its published store hours.',
  INSUFFICIENT_BALANCE: 'Your wallet balance is insufficient for this order.',
  INSUFFICIENT_STOCK: 'An item is out of stock. Please refresh your cart.',
  BELOW_MIN_ORDER_QTY: 'An item does not meet the minimum order quantity.',
  PRODUCT_UNAVAILABLE: 'An item is no longer available. Please refresh your cart.',
  EMPTY_CART: 'There are no items in this cart.',
  NO_WALLET: 'No wallet was found for your account. Refresh the page or contact support.',
  ACCOUNT_NOT_APPROVED: 'Your account must be approved before you can place an order.',
  ORDER_ROLE_NOT_ALLOWED: 'This account role cannot place marketplace orders.',
  DUPLICATE_CART_ITEM: 'Your cart contains a duplicate product. Remove it and add the product again.',
  INVALID_ORDER_ITEM: 'One or more cart items are invalid. Refresh your cart and try again.',
  MERCHANT_UNAVAILABLE: 'This Merchant is not currently available for orders.'
}

// Voucher error codes returned by resolve_voucher() -- surfaced next to
// the code input via quote_order()'s voucher_error field, and reused
// here for the rare race where place_order()'s re-validation (a code
// that expired or hit its usage limit between quote and place) fails
// instead.
const VOUCHER_ERROR_MESSAGES = {
  VOUCHER_NOT_FOUND: 'That voucher code doesn’t exist.',
  VOUCHER_EXPIRED: 'That voucher isn’t active right now.',
  VOUCHER_NOT_ELIGIBLE: 'That voucher doesn’t apply to the items in this cart.',
  VOUCHER_MIN_SPEND_NOT_MET: 'Your order doesn’t meet this voucher’s minimum spend.',
  VOUCHER_USAGE_LIMIT_REACHED: 'That voucher has reached its usage limit.',
  VOUCHER_ALREADY_USED: 'You’ve already used that voucher.',
  VOUCHER_INVALID: 'That voucher code is invalid.'
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
  const [customerAddress, setCustomerAddress] = useState(null)
  const [addressParts, setAddressParts] = useState(partsFromLegacyAddress(group?.customerAddress || ''))
  // place_customer_receiver_shipping_order requires the shipping address to
  // match the saved customer's address exactly (case-insensitive) -- it's
  // not a freeform field for that path, so skip the editable form entirely
  // and always submit the customer's own address, re-fetched live so it
  // can't drift from what the RPC will compare against.
  const address = customerId ? (customerAddress ?? '') : composeAddress(addressParts)
  const [submitting, setSubmitting] = useState(false)
  const [shippingGuideOpen, setShippingGuideOpen] = useState(false)
  const [shippingAccepted, setShippingAccepted] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [voucherInput, setVoucherInput] = useState('')
  const [activeVoucherCode, setActiveVoucherCode] = useState(null)

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

  const loadCustomerAddress = useCallback(async () => {
    if (!customerId) return
    const { data, error } = await supabase.from('customers').select('address').eq('id', customerId).maybeSingle()
    if (error) toast.error(error.message)
    setCustomerAddress(data?.address || '')
  }, [customerId])

  useEffect(() => {
    if (merchantId) loadMerchant()
    loadWallet()
    loadCustomerAddress()
  }, [merchantId, loadMerchant, loadWallet, loadCustomerAddress])
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
    supabase.rpc('quote_order', { p_merchant_id: merchantId, p_items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })), p_shipping_fee: 0, p_voucher_code: activeVoucherCode })
      .then(({ data, error }) => { if (!active) return; if (error) { setQuote(null); toast.error(`Unable to verify checkout price: ${error.message}`) } else setQuote(data); setQuoteLoading(false) })
    return () => { active = false }
  }, [merchantId, items, activeVoucherCode])

  const applyVoucher = () => setActiveVoucherCode(voucherInput.trim().toUpperCase() || null)
  const removeVoucher = () => { setVoucherInput(''); setActiveVoucherCode(null) }

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
        p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })), p_voucher_code: activeVoucherCode
      } : {
        p_merchant_id: merchantId, p_shipping_address: address,
        p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })), p_voucher_code: activeVoucherCode
      }
      const { data: order, error } = await supabase.rpc(rpc, params)

      if (error) throw error

      // Best-effort traceability: if any of these items came from a
      // storefront_order_requests "Convert to order", close the request
      // out now that a real order exists. Never blocks the order itself —
      // the order is already placed and paid for by this point.
      try {
        const pending = takePendingConversions(items.map((item) => item.cart_key))
        const requestIds = Object.values(pending)
        if (requestIds.length) {
          await supabase.from('storefront_order_requests')
            .update({ status: 'converted', converted_customer_id: customerId || null, converted_order_id: order?.id || null })
            .in('id', requestIds)
        }
      } catch {
        // Order already succeeded; a failure here only affects the
        // request's status label, not money or stock.
      }

      clearOrderItems(merchantId, customerId)
      toast.success('Order placed! Product and system fees were charged to your wallet. Shipping will be paid upon delivery.')
      navigate(role === 'merchant' ? '/merchant/purchases' : '/reseller/orders')
    } catch (err) {
      console.error('Checkout failed:', err)
      toast.error(ERROR_MESSAGES[err.message] || VOUCHER_ERROR_MESSAGES[err.message] || 'We could not place this order. Please refresh and try again.')
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
            {quote?.voucher_valid && Number(quote.voucher_discount) > 0 && <div className="flex justify-between text-teal-700"><span>Voucher ({activeVoucherCode})</span><span>-{peso(quote.voucher_discount)}</span></div>}
            <div className="flex justify-between border-t border-black/5 pt-3 font-display text-lg font-bold text-ink"><span>Final amount to pay</span><span className="text-teal-700">{peso(total)}</span></div>
          </div>

          <div className="mt-4 border-t border-black/5 pt-4">
            {activeVoucherCode ? (
              <div className="flex items-center justify-between rounded-xl bg-surface-inset px-3 py-2.5 text-sm">
                <span className="font-semibold text-ink">
                  {quoteLoading ? `Checking ${activeVoucherCode}…` : quote?.voucher_valid ? <span className="text-teal-700">"{activeVoucherCode}" applied</span> : <span className="text-coral-600">{VOUCHER_ERROR_MESSAGES[quote?.voucher_error] || quote?.voucher_error || 'That voucher isn’t valid for this order.'}</span>}
                </span>
                <button type="button" onClick={removeVoucher} className="text-xs font-semibold text-ink/50 hover:underline">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" placeholder="Voucher code" className="input-field flex-1 text-sm uppercase" value={voucherInput} onChange={(e) => setVoucherInput(e.target.value)} />
                <button type="button" disabled={!voucherInput.trim()} onClick={applyVoucher} className="btn-secondary px-4 text-sm">Apply</button>
              </div>
            )}
          </div>
          {resellerOperationFee > 0 && <p className="mt-3 text-xs leading-5 text-ink/50">Server-verified wholesale amount plus the system fee will be charged. The fee is capped from {peso(quote?.reseller_fee_minimum || 3)} to {peso(quote?.reseller_fee_maximum || 50)} per order. Earnings are not guaranteed.</p>}
          {role === 'reseller' && <div className={`mt-4 grid grid-cols-2 gap-3 rounded-xl p-4 ${estimatedProfit > 0 ? 'bg-mango-100/60 dark:bg-mango-500/10' : 'bg-coral-50 dark:bg-coral-500/10'}`}><div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Your customer will pay</p><p className="mt-1 font-display text-lg font-bold text-ink">{peso(customerRevenue)}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Estimated Reseller profit</p><p className={`mt-1 font-display text-lg font-bold ${estimatedProfit > 0 ? 'text-teal-700' : 'text-coral-600'}`}>{peso(estimatedProfit)}</p></div><p className="col-span-2 text-[10px] leading-4 text-ink/45">Cart estimate after the JOM HUB system fee, before delivery, marketing, returns, and taxes. The customer selling price is not charged by JOM HUB.</p></div>}
          <p className={`mt-2 text-xs font-semibold ${quote ? 'text-teal-700' : 'text-mango-700'}`}>{quoteLoading ? 'Verifying the latest secure price…' : quote ? 'Price verified by the secure checkout server.' : 'Price verification unavailable.'}</p>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Shipping Address</h2>
          {customerId ? (
            <>
              <p className="rounded-xl bg-surface-inset px-4 py-3 text-sm text-ink/80">{address || 'Loading…'}</p>
              <p className="mt-2 text-xs text-ink/45">This order ships to {group?.customerName}'s saved address. To change it, update the customer's address from <Link to="/reseller/customers" className="font-semibold text-teal-700 underline">Customers</Link> first.</p>
            </>
          ) : (
            <AddressFields value={addressParts} onChange={setAddressParts} required />
          )}
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
