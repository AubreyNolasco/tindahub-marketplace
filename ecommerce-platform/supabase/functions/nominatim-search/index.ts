const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-jomhub-device-id' }

// Server-side proxy for OpenStreetMap's Nominatim search — needed
// because nominatim.openstreetmap.org sends no Access-Control-Allow-Origin
// header, so a direct browser fetch() to it always fails with a CORS
// error regardless of this app's own CSP (confirmed live: curl/Node
// reach it fine since neither enforces CORS, but a real browser cannot).
// Deployed with --no-verify-jwt: the public storefront order form
// (src/pages/ResellerStorefront.jsx, no login) needs this same as any
// other visitor.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires an identifying User-Agent and roughly 1 request/second —
// callers debounce client-side (see src/lib/services/nominatim.js), and
// this function itself does not retry or fan out multiple requests per call.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { q } = await req.json()
    if (typeof q !== 'string' || q.trim().length < 3) throw new Error('QUERY_TOO_SHORT')
    const query = q.trim().slice(0, 200)

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ph&limit=5&q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'JOMHUB-marketplace/1.0 (+https://tindahub-marketplace.vercel.app)' }
    })
    if (!response.ok) throw new Error('NOMINATIM_UNAVAILABLE')
    const results = await response.json()

    const mapped = results.map((result: { place_id: number; display_name: string; lat: string; lon: string }) => ({
      id: result.place_id,
      label: result.display_name,
      latitude: Number(result.lat),
      longitude: Number(result.lon)
    }))

    return new Response(JSON.stringify({ results: mapped }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
