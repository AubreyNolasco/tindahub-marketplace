// Bridges "Convert to order" on a storefront_order_request to the
// unmodified Cart -> Checkout flow. Convert just adds the item to cart
// and navigates to /reseller/cart; the request itself isn't marked
// 'converted' until an order actually clears place_customer_receiver_shipping_order
// in Checkout.jsx, which reads this map by cart_key after a successful
// order to know which request(s) to close out. sessionStorage (not
// CartContext state) because it must survive the Cart -> Checkout
// navigation without threading extra props through unrelated pages.
const STORAGE_KEY = 'jomhub_pending_storefront_conversions'

function readMap() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Private/restricted browsing contexts may block storage; conversion
    // traceability is best-effort and never blocks the order itself.
  }
}

export function markPendingConversion(cartKey, requestId) {
  const map = readMap()
  map[cartKey] = requestId
  writeMap(map)
}

// Removes and returns any pending conversions among the given cart keys,
// so a Checkout success handler can close them out without leaving stale
// entries for a future, unrelated cart item that happens to reuse the key.
export function takePendingConversions(cartKeys) {
  const map = readMap()
  const matches = {}
  let changed = false
  cartKeys.forEach((key) => {
    if (map[key]) {
      matches[key] = map[key]
      delete map[key]
      changed = true
    }
  })
  if (changed) writeMap(map)
  return matches
}
