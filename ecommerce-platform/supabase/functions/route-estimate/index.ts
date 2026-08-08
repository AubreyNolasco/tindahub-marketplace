import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-jomhub-device-id' }

// Free, no-credentials road-distance/route estimate (TASK8.md's "Shipping
// Module" ask: pickup + dropoff in, distance/ETA/route out, no paid API).
// Merchant-pickup/customer-dropoff resolution below mirrors
// delivery-quote/index.ts exactly (same tables, same error codes
// MERCHANT_PICKUP_LOCATION_MISSING/CUSTOMER_LOCATION_MISSING) so
// ShippingFeeModal.jsx's existing error-message mapping already handles
// this function's failures without new cases.
//
// Deliberately NOT wired into delivery_provider_accounts /
// resolve_delivery_candidates / propose_order_shipping_fee's dispatch
// pipeline — that pipeline assumes a bookable courier account with
// credentials (CREDENTIALS_REQUIRED in save_delivery_provider_account),
// which doesn't fit a keyless public routing lookup. This is
// display/estimate-only: the Merchant still types/confirms the actual
// fee before it's ever charged, same as before this existed.
//
// VERIFY before relying on this at real volume: router.project-osrm.org is
// OSRM's public demo server, and OSRM's own usage policy prohibits heavy
// or commercial use of it — acceptable for building/testing this feature,
// but a genuinely production-safe setup needs a self-hosted OSRM instance
// (Docker + a PH OSM extract) pointed to via the OSRM_BASE_URL env var
// below, which this project's current hosting (Vercel + Supabase, both
// fully managed) has nowhere to run persistently yet. See TASK8.md's
// Recommendations section for the tradeoff.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { order_id } = await req.json()
    if (typeof order_id !== 'string' || !order_id) throw new Error('Invalid request')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, merchant_id, reseller_id, customer_id')
      .eq('id', order_id)
      .single()
    if (orderError || !order) throw new Error('Order not found')
    if (order.merchant_id !== user.id && order.reseller_id !== user.id) throw new Error('Forbidden')

    const { data: merchant, error: merchantError } = await admin
      .from('merchant_profiles')
      .select('pickup_latitude, pickup_longitude')
      .eq('id', order.merchant_id)
      .single()
    if (merchantError || !merchant) throw new Error('Merchant profile not found')
    if (merchant.pickup_latitude == null || merchant.pickup_longitude == null) throw new Error('MERCHANT_PICKUP_LOCATION_MISSING')

    let customer: { latitude: number | null; longitude: number | null } | null = null
    if (order.customer_id) {
      const { data } = await admin.from('customers').select('latitude, longitude').eq('id', order.customer_id).single()
      customer = data
    }
    if (!customer || customer.latitude == null || customer.longitude == null) throw new Error('CUSTOMER_LOCATION_MISSING')

    const base = Deno.env.get('OSRM_BASE_URL') || 'https://router.project-osrm.org'
    const coords = `${merchant.pickup_longitude},${merchant.pickup_latitude};${customer.longitude},${customer.latitude}`
    const res = await fetch(`${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`)
    const body = await res.json()

    if (!res.ok || body?.code !== 'Ok' || !body?.routes?.[0]) {
      const message = body?.message || `OSRM returned HTTP ${res.status}`
      throw new Error(body?.code === 'NoRoute' ? 'NO_ROAD_ROUTE_FOUND' : message)
    }

    const route = body.routes[0]
    // GeoJSON is [lng, lat] pairs; flip to [lat, lng] since that's what
    // Leaflet (and every other lat/lng field already in this codebase)
    // expects, so the frontend never has to remember which order this one
    // response uses.
    const geometry: [number, number][] = (route.geometry?.coordinates || []).map(([lng, lat]: [number, number]) => [lat, lng])

    return new Response(
      JSON.stringify({
        distance_km: Number((route.distance / 1000).toFixed(2)),
        duration_min: Math.round(route.duration / 60),
        geometry,
        pickup: { lat: merchant.pickup_latitude, lng: merchant.pickup_longitude },
        dropoff: { lat: customer.latitude, lng: customer.longitude },
        provider: base.includes('project-osrm.org') ? 'osrm_public_demo' : 'osrm_self_hosted',
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
