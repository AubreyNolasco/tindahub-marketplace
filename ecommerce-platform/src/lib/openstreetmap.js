// End-user initiated, completed-address geocoding for the Leaflet picker.
// This is deliberately not used for autocomplete: the public Nominatim
// policy forbids client-side autocomplete and caps an application at 1 req/s.
const API_URL = 'https://nominatim.openstreetmap.org'
const MIN_REQUEST_INTERVAL = 1100
const memoryCache = new Map()
let requestQueue = Promise.resolve()
let lastRequestAt = 0

export function partsFromResult(result) {
  const address = result?.address || {}
  const street = [address.house_number, address.road || address.pedestrian || address.residential].filter(Boolean).join(' ')
  return {
    label: result?.display_name || '',
    street: street || address.building || '',
    barangay: address.suburb || address.neighbourhood || address.village || address.quarter || '',
    city: address.city || address.town || address.municipality || address.city_district || '',
    // Philippine Nominatim results commonly expose the actual province
    // separately from the broader administrative region. Prefer it so
    // Cebu does not become "Central Visayas", for example.
    province: address.province || address.state_district || address.county || address.state || address.region || '',
    postalCode: address.postcode || '',
    latitude: result?.lat ? Number(result.lat) : null,
    longitude: result?.lon ? Number(result.lon) : null,
  }
}

function cached(key) {
  if (memoryCache.has(key)) return memoryCache.get(key)
  try {
    const value = sessionStorage.getItem(`osm-geocode:${key}`)
    return value ? JSON.parse(value) : undefined
  } catch { return undefined }
}

function remember(key, value) {
  memoryCache.set(key, value)
  try { sessionStorage.setItem(`osm-geocode:${key}`, JSON.stringify(value)) } catch { /* storage may be unavailable */ }
  return value
}

function rateLimitedFetch(url, signal) {
  const run = async () => {
    const wait = Math.max(0, MIN_REQUEST_INTERVAL - (Date.now() - lastRequestAt))
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    lastRequestAt = Date.now()
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`OpenStreetMap geocoder returned HTTP ${response.status}`)
    return response.json()
  }
  const result = requestQueue.then(run, run)
  requestQueue = result.catch(() => {})
  return result
}

export async function geocodeOpenStreetMap(query, signal) {
  const normalized = query?.trim().toLocaleLowerCase()
  if (!normalized) return null
  const key = `search:${normalized}`
  const existing = cached(key)
  if (existing !== undefined) return existing
  const url = `${API_URL}/search?format=jsonv2&addressdetails=1&countrycodes=ph&limit=1&q=${encodeURIComponent(query.trim())}`
  const rows = await rateLimitedFetch(url, signal)
  return remember(key, Array.isArray(rows) && rows[0] ? partsFromResult(rows[0]) : null)
}

export async function reverseOpenStreetMap(latitude, longitude, signal) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  const key = `reverse:${lat.toFixed(6)},${lng.toFixed(6)}`
  const existing = cached(key)
  if (existing !== undefined) return existing
  const url = `${API_URL}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
  const result = await rateLimitedFetch(url, signal)
  return remember(key, result?.error ? null : partsFromResult(result))
}
