// Free-text address search against OpenStreetMap's public Nominatim
// instance — used only to help a user find their pin faster on the map
// (LocationPickerMap.jsx); it never writes a value directly into the
// address form. PSGC dropdowns and the pin itself remain the source of
// truth, same as before — this is a shortcut to *placing* the pin, not a
// geocoding provider snapping guesses onto PSGC data (that pattern was
// deliberately removed once already, see resolveGeocodedPsgc() in
// TASK11.md's history).
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires: no more than ~1 request/second, and an identifying
// User-Agent or Referer — browsers already send Referer automatically,
// so no extra header is needed from client-side fetch. Callers are
// responsible for debouncing; this module does not rate-limit itself.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export async function searchPhilippineAddress(query, { signal } = {}) {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []
  const url = `${NOMINATIM_URL}?format=jsonv2&countrycodes=ph&limit=5&q=${encodeURIComponent(trimmed)}`
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Address search failed.')
  const results = await response.json()
  return results.map((result) => ({
    id: result.place_id,
    label: result.display_name,
    latitude: Number(result.lat),
    longitude: Number(result.lon)
  }))
}
