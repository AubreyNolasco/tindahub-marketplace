import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requestQuotation, countryMarket } from '../_shared/lalamove.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' }

// Merchant-invoked: gets a live Lalamove quote for an order using the
// RESELLER's own Lalamove credentials (each reseller owns their account —
// the merchant never sees the reseller's key/secret, only the resulting
// price). Pickup/dropoff coordinates and the credentials themselves are
// only ever read server-side with the service-role key.
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
      .select('id, merchant_id, reseller_id, customer_id, status')
      .eq('id', order_id)
      .single()
    if (orderError || !order) throw new Error('Order not found')
    if (order.merchant_id !== user.id) throw new Error('Forbidden')
    if (order.status !== 'processing') throw new Error('ORDER_NOT_IN_PROCESSING')

    const { data: creds } = await admin.rpc('get_lalamove_credentials', { p_owner_id: order.reseller_id })
    const cred = Array.isArray(creds) ? creds[0] : creds
    if (!cred?.api_key || !cred?.api_secret) throw new Error('LALAMOVE_NOT_CONNECTED')

    const { data: merchant, error: merchantError } = await admin
      .from('merchant_profiles')
      .select('business_name, business_address, pickup_latitude, pickup_longitude')
      .eq('id', order.merchant_id)
      .single()
    if (merchantError || !merchant) throw new Error('Merchant profile not found')
    if (merchant.pickup_latitude == null || merchant.pickup_longitude == null) throw new Error('MERCHANT_PICKUP_LOCATION_MISSING')

    let customer: { name: string; phone: string | null; address: string | null; latitude: number | null; longitude: number | null } | null = null
    if (order.customer_id) {
      const { data } = await admin
        .from('customers')
        .select('name, phone, address, latitude, longitude')
        .eq('id', order.customer_id)
        .single()
      customer = data
    }
    if (!customer || customer.latitude == null || customer.longitude == null) throw new Error('CUSTOMER_LOCATION_MISSING')

    const quote = await requestQuotation({
      apiKey: cred.api_key,
      apiSecret: cred.api_secret,
      market: countryMarket(cred.market),
      pickup: { lat: merchant.pickup_latitude, lng: merchant.pickup_longitude, address: merchant.business_address || '' },
      dropoff: { lat: customer.latitude, lng: customer.longitude, address: customer.address || '' },
    })

    if (!quote.quotationId || !quote.priceTotal) throw new Error('LALAMOVE_QUOTE_FAILED')

    return new Response(
      JSON.stringify({ quotation_id: quote.quotationId, price: quote.priceTotal, currency: quote.currency || 'PHP' }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
