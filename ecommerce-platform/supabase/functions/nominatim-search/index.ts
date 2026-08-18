// Allow-Headers must list every header the supabase-js client can attach to
// an invoke() call (content-type, apikey, authorization, x-client-info,
// x-retry-count — see node_modules/@supabase/supabase-js/src/cors.ts) plus
// this app's own x-jomhub-device-id, or the browser silently fails the
// request after a passing OPTIONS preflight: supabase.functions.invoke()
// always attaches x-client-info, so omitting it here broke every call.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info, x-retry-count, x-jomhub-device-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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
// requires an identifying User-Agent and roughly 1 request/second. That
// budget used to be per-browser (each visitor hit Nominatim directly
// under their own network identity); routed through this one function,
// every visitor now shares a single IP, so concurrent visitors could
// collectively blow past the policy and get that shared IP rate-limited
// for everyone. Outgoing requests are serialized below with a minimum
// spacing between them to stay under the limit regardless of how many
// callers show up at once. This only throttles requests reaching this
// warm isolate — it's not a global/cross-instance limiter — but it
// removes the case where a normal traffic burst alone trips the policy.
let queueTail: Promise<unknown> = Promise.resolve()
let pending = 0
const MIN_INTERVAL_MS = 1100
const MAX_PENDING = 20

function throttledFetch(url: string, init: RequestInit): Promise<Response> {
  if (pending >= MAX_PENDING) return Promise.reject(new Error('TOO_MANY_REQUESTS'))
  pending++
  const result = queueTail.then(() => fetch(url, init))
  result.finally(() => { pending-- })
  queueTail = result.catch(() => {}).then(() => new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS)))
  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { q } = await req.json()
    if (typeof q !== 'string' || q.trim().length < 3) throw new Error('QUERY_TOO_SHORT')
    const query = q.trim().slice(0, 200)

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ph&limit=5&q=${encodeURIComponent(query)}`
    const response = await throttledFetch(url, {
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
    const status = error.message === 'TOO_MANY_REQUESTS' ? 429 : 400
    return new Response(JSON.stringify({ error: error.message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
