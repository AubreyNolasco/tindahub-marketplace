import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requestQuotation, placeOrder, countryMarket } from '../_shared/lalamove.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret' }

// System-invoked only (never by a browser): fired by the
// trg_notify_lalamove_dispatch_ready trigger via net.http_post the moment
// the Reseller accepts a Lalamove-sourced shipping fee. Books the real
// Lalamove delivery and marks the order shipped through
// complete_lalamove_dispatch(). On any failure it records the reason and
// leaves the order in 'processing' so the merchant can fall back to manual
// dispatch — it must never leave an order silently stuck.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let orderId: string | null = null
  let bookingId: string | null = null

  try {
    const secret = req.headers.get('x-cron-secret') || ''
    if (!secret || secret !== Deno.env.get('LALAMOVE_DISPATCH_SECRET')) throw new Error('Unauthorized')

    const body = await req.json()
    orderId = typeof body.order_id === 'string' ? body.order_id : null
    if (!orderId) throw new Error('Invalid request')

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, merchant_id, reseller_id, customer_id, status, shipping_fee_confirmation_status, proposed_shipping_fee')
      .eq('id', orderId)
      .single()
    if (orderError || !order) throw new Error('Order not found')
    if (order.status !== 'processing' || order.shipping_fee_confirmation_status !== 'accepted' || order.proposed_shipping_fee == null) {
      // Order moved on (manually dispatched, cancelled, etc.) between the
      // trigger firing and this call landing — nothing to do.
      return new Response(JSON.stringify({ ok: true, skipped: 'ORDER_NOT_DISPATCH_READY' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Claim the idempotency slot atomically. The partial unique index on
    // lalamove_bookings(order_id) where status not in ('cancelled','failed')
    // rejects a concurrent second attempt for the same order.
    const { data: booking, error: bookingInsertError } = await admin
      .from('lalamove_bookings')
      .insert({ order_id: order.id, reseller_id: order.reseller_id, status: 'booking' })
      .select('id')
      .single()
    if (bookingInsertError) {
      if (bookingInsertError.code === '23505') {
        return new Response(JSON.stringify({ ok: true, skipped: 'ALREADY_BOOKED_OR_BOOKING' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      }
      throw bookingInsertError
    }
    bookingId = booking.id

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

    const { data: merchantProfile } = await admin.from('profiles').select('phone').eq('id', order.merchant_id).single()

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

    const market = countryMarket(cred.market)
    const pickup = { lat: merchant.pickup_latitude, lng: merchant.pickup_longitude, address: merchant.business_address || '' }
    const dropoff = { lat: customer.latitude, lng: customer.longitude, address: customer.address || '' }

    // Quotes expire quickly on Lalamove's side — always re-quote right
    // before placing the order rather than reusing an earlier stored one.
    const quote = await requestQuotation({ apiKey: cred.api_key, apiSecret: cred.api_secret, market, pickup, dropoff })
    if (!quote.quotationId || !quote.pickupStopId || !quote.dropoffStopId) throw new Error('LALAMOVE_QUOTE_FAILED')

    await admin.from('lalamove_bookings').update({ lalamove_quotation_id: quote.quotationId, quote_data: quote.raw, updated_at: new Date().toISOString() }).eq('id', bookingId)

    const placed = await placeOrder({
      apiKey: cred.api_key,
      apiSecret: cred.api_secret,
      market,
      quotationId: quote.quotationId,
      pickupStopId: quote.pickupStopId,
      dropoffStopId: quote.dropoffStopId,
      senderName: merchant.business_name || 'Merchant',
      senderPhone: merchantProfile?.phone || '',
      recipientName: customer.name,
      recipientPhone: customer.phone || '',
      orderId: order.id,
    })
    if (!placed.lalamoveOrderId) throw new Error('LALAMOVE_BOOKING_FAILED')

    await admin
      .from('lalamove_bookings')
      .update({
        status: 'booked',
        lalamove_order_id: placed.lalamoveOrderId,
        booking_request: { quotationId: quote.quotationId, pickup, dropoff },
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    const { error: dispatchError } = await admin.rpc('complete_lalamove_dispatch', {
      p_order_id: order.id,
      p_lalamove_order_id: placed.lalamoveOrderId,
    })
    if (dispatchError) throw dispatchError

    return new Response(JSON.stringify({ ok: true, lalamove_order_id: placed.lalamoveOrderId }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    if (bookingId) {
      await admin.from('lalamove_bookings').update({ status: 'failed', failure_reason: String(error.message || error), updated_at: new Date().toISOString() }).eq('id', bookingId)
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
