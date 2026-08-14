import { supabase } from '../supabase'

// Free-text address search — used only to help a user find their pin
// faster on the map (LocationPickerMap.jsx); it never writes a value
// directly into the address form. PSGC dropdowns and the pin itself
// remain the source of truth, same as before — this is a shortcut to
// *placing* the pin, not a geocoding provider snapping guesses onto PSGC
// data (that pattern was deliberately removed once already, see
// resolveGeocodedPsgc() in TASK11.md's history).
//
// Routed through the nominatim-search edge function rather than calling
// nominatim.openstreetmap.org directly from the browser: Nominatim sends
// no Access-Control-Allow-Origin header, so a direct client-side fetch
// always fails with a CORS error (confirmed live) even though curl/Node
// reach it fine — CORS is enforced by the browser, not the server.
// Callers are responsible for debouncing; this module does not
// rate-limit itself.
export async function searchPhilippineAddress(query) {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []
  const { data, error } = await supabase.functions.invoke('nominatim-search', { body: { q: trimmed } })
  if (error) throw error
  return data?.results || []
}
