// Great-circle (straight-line) distance between two lat/lng points, in
// kilometers. Mirrors the SQL haversine_km() function
// (20260813000200_shipping_pricing_engine.sql) — this JS copy is safe to
// keep alongside it because the haversine formula is universal math, not
// a business rule that can drift the way pricing constants would.
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}
