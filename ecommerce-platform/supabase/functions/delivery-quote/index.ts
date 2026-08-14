import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/delivery/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-jomhub-device-id' }

// VERIFY: Lalamove's exact PH serviceType enum once a real sandbox
// account is available (see _shared/lalamove.ts header). Only the two
// values the owner actually asked to distinguish (motorcycle vs. a real
// car for bulkier orders) are exposed for now.
const ALLOWED_SERVICE_TYPES = new Set(['MOTORCYCLE', 'CAR'])

// Merchant-invoked: generalizes lalamove-quote to try every delivery
// account available for this order — the Merchant's own, then the
// Reseller's, then the Platform's (resolve_delivery_candidates, in that
// priority order) — and returns the first one that produces a live
// quote. The caller only ever sees the winning provider; picking among
// tiers is the engine's job, not the merchant's.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { order_id, service_type } = await req.json()
    if (typeof order_id !== 'string' || !order_id) throw new Error('Invalid request')
    const serviceType = typeof service_type === 'string' && ALLOWED_SERVICE_TYPES.has(service_type) ? service_type : undefined

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, merchant_id, reseller_id, customer_id, status')
      .eq('id', order_id)
      .single()
    if (orderError || !order) throw new Error('Order not found')
    if (order.merchant_id !== user.id) throw new Error('Forbidden')
    if (order.status !== 'processing') throw new Error('ORDER_NOT_IN_PROCESSING')

    const { data: merchant, error: merchantError } = await admin
      .from('merchant_profiles')
      .select('business_name, business_address, pickup_latitude, pickup_longitude')
      .eq('id', order.merchant_id)
      .single()
    if (merchantError || !merchant) throw new Error('Merchant profile not found')
    if (merchant.pickup_latitude == null || merchant.pickup_longitude == null) throw new Error('MERCHANT_PICKUP_LOCATION_MISSING')

    let customer: { name: string; phone: string | null; address: string | null; latitude: number | null; longitude: number | null } | null = null
    if (order.customer_id) {
      const { data } = await admin.from('customers').select('name, phone, address, latitude, longitude').eq('id', order.customer_id).single()
      customer = data
    }
    if (!customer || customer.latitude == null || customer.longitude == null) throw new Error('CUSTOMER_LOCATION_MISSING')

    const pickup = { lat: merchant.pickup_latitude, lng: merchant.pickup_longitude, address: merchant.business_address || '' }
    const dropoff = { lat: customer.latitude, lng: customer.longitude, address: customer.address || '' }

    const { data: candidates, error: candidatesError } = await admin.rpc('resolve_delivery_candidates', { p_order_id: order_id })
    if (candidatesError) throw candidatesError
    if (!candidates || candidates.length === 0) throw new Error('DELIVERY_NOT_AVAILABLE')

    let lastErrorCode = 'DELIVERY_NOT_AVAILABLE'
    for (const candidate of candidates) {
      const { data: cred } = await admin.rpc('get_delivery_provider_credentials', { p_account_id: candidate.id })
      const quote = await getAdapter(candidate.provider_code).getQuote({ pickup, dropoff, serviceType }, cred)
      if (quote.ok) {
        return new Response(
          JSON.stringify({
            quotation_id: quote.externalQuoteId,
            price: quote.fee,
            currency: quote.currency || 'PHP',
            provider_code: candidate.provider_code,
            account_id: candidate.id,
            service_type: serviceType || 'MOTORCYCLE',
          }),
          { headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }
      lastErrorCode = quote.error?.code || lastErrorCode
    }

    throw new Error(lastErrorCode)
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
