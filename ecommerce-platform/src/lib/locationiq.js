// LocationIQ Autocomplete — https://locationiq.com/docs (free tier: 5,000
// requests/day, no credit card, OpenStreetMap-based). Plain REST API, no
// script tag to inject — unlike Google's Places widget, the caller
// debounces keystrokes and renders its own suggestion list.
//
// VERIFY the address-component key names below (suburb/neighbourhood for
// barangay, state for province) against a handful of real PH results
// once a live key is in place — OSM tagging isn't perfectly consistent
// across every municipality, same "matches published docs, never
// exercised live" caveat as every other adapter in this codebase.

const API_URL = 'https://api.locationiq.com/v1/autocomplete'

export function isLocationIqConfigured() {
  return Boolean(import.meta.env.VITE_LOCATIONIQ_API_KEY)
}

function partsFromResult(result) {
  const addr = result.address || {}
  const street = [addr.house_number, addr.road].filter(Boolean).join(' ')
  return {
    label: result.display_name || '',
    street: street || addr.name || '',
    barangay: addr.suburb || addr.neighbourhood || addr.village || addr.quarter || '',
    city: addr.city || addr.town || addr.municipality || '',
    province: addr.state || addr.county || '',
    postalCode: addr.postcode || '',
    latitude: result.lat ? Number(result.lat) : null,
    longitude: result.lon ? Number(result.lon) : null,
  }
}

export async function searchAddress(query, signal) {
  const apiKey = import.meta.env.VITE_LOCATIONIQ_API_KEY
  if (!apiKey || !query || query.trim().length < 3) return []

  const url = `${API_URL}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query.trim())}&countrycodes=ph&limit=5&format=json&addressdetails=1&normalizeaddress=1`
  const res = await fetch(url, { signal })
  if (!res.ok) {
    if (res.status === 404) return [] // LocationIQ returns 404 for "no results", not an error
    throw new Error(`LocationIQ returned HTTP ${res.status}`)
  }
  const body = await res.json()
  if (!Array.isArray(body)) return []
  return body.map(partsFromResult)
}
