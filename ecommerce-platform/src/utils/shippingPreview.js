// Estimates what a shipping_pricing_rules row would charge at a given
// straight-line distance -- used by the admin Shipping Pricing form to
// preview a draft rate before publishing it. Mirrors the fee-application
// math inside calculate_standard_shipping() (20260813000200_shipping_pricing_engine.sql),
// NOT the vehicle-selection logic, since vehicle selection depends on a
// live cart's product weights/dimensions that don't exist yet for a
// draft rule being edited in isolation. This is a preview only -- the
// SQL function remains the sole source of truth for what an order is
// actually charged.
export function previewShippingFee(rule, distanceKm) {
  const {
    base_fee: baseFee,
    included_distance_km: includedDistanceKm,
    rate_per_km: ratePerKm,
    additional_distance_rate: additionalDistanceRate,
    minimum_fee: minimumFee,
    maximum_fee: maximumFee,
    surcharge_percent: surchargePercent = 0,
    rounding_increment: roundingIncrement = 5,
    road_directness_multiplier: roadDirectnessMultiplier = 1
  } = rule

  const billingDistanceKm = Math.ceil(distanceKm * roadDirectnessMultiplier)
  const charge = billingDistanceKm <= includedDistanceKm
    ? billingDistanceKm * ratePerKm
    : includedDistanceKm * ratePerKm + (billingDistanceKm - includedDistanceKm) * additionalDistanceRate

  let fee = (baseFee + charge) * (1 + surchargePercent / 100)
  fee = Math.ceil(fee / roundingIncrement) * roundingIncrement
  if (minimumFee != null) fee = Math.max(fee, minimumFee)
  if (maximumFee != null) fee = Math.min(fee, maximumFee)

  return { fee, billingDistanceKm }
}
