// Turns the raw reason quote_order()/place_order() capture when automatic
// shipping pricing can't be computed (a bare SQL exception code, or
// place_order()'s "Manual quotation required (CODE)" wrapper) into a
// message a Reseller or Merchant can actually act on. Restores the
// mapping ShippingFeeModal.jsx used to have before its old
// "Free distance estimate" button (and this mapping with it) was removed
// — see TASK11.md's "Reviewed but not changed" note.
const REASON_LABELS = {
  MISSING_PACKAGE_INFORMATION: 'One or more products are missing packed weight/dimensions.',
  MANUAL_QUOTATION_REQUIRED: 'This order is too large or heavy for the standard pricing formula.',
  SHIPPING_PRICING_NOT_CONFIGURED: 'Shipping rates are not configured for this vehicle type yet.',
  ROAD_DISTANCE_REQUIRED: 'The delivery distance could not be calculated.',
  PRODUCT_UNAVAILABLE: 'One of the items is no longer available.',
  EMPTY_CART: 'The cart is empty.'
}

export function describeShippingFallback(rawReason) {
  if (!rawReason) return null
  // Only matches when a real automatic-pricing attempt actually failed with
  // a known code — not place_order()'s default "Receiver pays actual
  // shipping upon delivery" (no pickup/delivery pins at all, the common
  // case for most merchants today per TASK11.md), which isn't a specific,
  // actionable diagnostic worth surfacing.
  const code = Object.keys(REASON_LABELS).find((c) => rawReason.includes(c))
  return code ? REASON_LABELS[code] : null
}
