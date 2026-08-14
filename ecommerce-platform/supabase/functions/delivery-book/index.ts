import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/delivery/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret, x-jomhub-device-id' }

// System-invoked only (never by a browser): generalizes lalamove-book.
// Fired by trg_notify_lalamove_dispatch_ready the moment the Reseller
// accepts a fee that came from an automatic quote. Books through
// whichever account actually produced that quote — Merchant, Reseller,
// or Platform, recorded on the order as delivery_quote_account_id — not
// always the Reseller's own Lalamove account. On any failure it records
// the reason and leaves the order in 'processing' so the merchant can
// fall back to manual dispatch — it must never leave an order silently
// stuck.
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
      .select('id, merchant_id, reseller_id, customer_id, status, shipping_fee_confirmation_status, proposed_shipping_fee, delivery_quote_account_id, delivery_service_type')
      .eq('id', orderId)
      .single()
    if (orderError || !order) throw new Error('Order not found')
    if (
      order.status !== 'processing' ||
      order.shipping_fee_confirmation_status !== 'accepted' ||
      order.proposed_shipping_fee == null ||
      !order.delivery_quote_account_id
    ) {
      // Order moved on (manually dispatched, cancelled, etc.) between the
      // trigger firing and this call landing — nothing to do.
      return new Response(JSON.stringify({ ok: true, skipped: 'ORDER_NOT_DISPATCH_READY' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const { data: account, error: accountError } = await admin
      .from('delivery_provider_accounts')
      .select('id, provider_code')
      .eq('id', order.delivery_quote_account_id)
      .single()
    if (accountError || !account) throw new Error('DELIVERY_ACCOUNT_NOT_FOUND')

    // Claim the idempotency slot atomically. The partial unique index on
    // lalamove_bookings(order_id) where status not in ('cancelled','failed')
    // rejects a concurrent second attempt for the same order, regardless
    // of which provider is booking it.
    const { data: booking, error: bookingInsertError } = await admin
      .from('lalamove_bookings')
      .insert({ order_id: order.id, reseller_id: order.reseller_id, status: 'booking', provider_code: account.provider_code })
      .select('id')
      .single()
    if (bookingInsertError) {
      if (bookingInsertError.code === '23505') {
        return new Response(JSON.stringify({ ok: true, skipped: 'ALREADY_BOOKED_OR_BOOKING' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      }
      throw bookingInsertError
    }
    bookingId = booking.id

    const { data: cred } = await admin.rpc('get_delivery_provider_credentials', { p_account_id: account.id })

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
      const { data } = await admin.from('customers').select('name, phone, address, latitude, longitude').eq('id', order.customer_id).single()
      customer = data
    }
    if (!customer || customer.latitude == null || customer.longitude == null) throw new Error('CUSTOMER_LOCATION_MISSING')

    const pickup = { lat: merchant.pickup_latitude, lng: merchant.pickup_longitude, address: merchant.business_address || '', name: merchant.business_name || 'Merchant', phone: merchantProfile?.phone || '' }
    const dropoff = { lat: customer.latitude, lng: customer.longitude, address: customer.address || '', name: customer.name, phone: customer.phone || '' }

    const booked = await getAdapter(account.provider_code).createBooking({ orderId: order.id, pickup, dropoff, serviceType: order.delivery_service_type || undefined }, cred)
    if (!booked.ok || !booked.externalOrderId) throw new Error(booked.error?.code || 'DELIVERY_BOOKING_FAILED')

    await admin
      .from('lalamove_bookings')
      .update({
        status: 'booked',
        lalamove_order_id: booked.externalOrderId,
        quote_data: booked.raw,
        booking_request: { pickup, dropoff },
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    const { error: dispatchError } = await admin.rpc('complete_lalamove_dispatch', {
      p_order_id: order.id,
      p_lalamove_order_id: booked.externalOrderId,
      p_provider_code: account.provider_code,
    })
    if (dispatchError) throw dispatchError

    return new Response(
      JSON.stringify({ ok: true, provider_code: account.provider_code, external_order_id: booked.externalOrderId }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    if (bookingId) {
      await admin.from('lalamove_bookings').update({ status: 'failed', failure_reason: String(error.message || error), updated_at: new Date().toISOString() }).eq('id', bookingId)
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
