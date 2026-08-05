import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' }

// VERIFY against live Lalamove webhook docs before going live: the exact
// header name Lalamove signs with. Left as a named constant so it's a
// one-line fix once confirmed against a real sandbox account.
const SIGNATURE_HEADER = 'x-lalamove-signature'

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Public endpoint Lalamove calls with delivery status updates. The
// signing secret to verify against depends on whichever account
// (Merchant, Reseller, or Platform tier) actually produced the booking
// — resolved via the order's delivery_quote_account_id, same source
// delivery-book itself used to book it. (Previously this looked up
// credentials via the reseller-only get_lalamove_credentials/
// lalamove_settings path, which stopped being written to once
// save_delivery_provider_account/delivery_provider_accounts became the
// live credential store — that made cred always come back empty here,
// silently skipping signature verification for every booking made
// through the current system.)
// Deliberately does NOT touch orders.status: the existing 7-day
// buyer-confirmation flow (complete_due_deliveries) stays the source of
// truth for order completion even after Lalamove reports COMPLETED.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)
    // VERIFY: exact response shape — Lalamove's webhook payload nests the
    // order id/status somewhere under `data`; adjust once confirmed.
    const lalamoveOrderId: string | undefined = payload?.data?.order?.orderId || payload?.data?.orderId || payload?.orderId
    const status: string | undefined = payload?.data?.status || payload?.status
    const driverInfo = payload?.data?.driver || payload?.driver || null
    if (!lalamoveOrderId) throw new Error('Missing order id in webhook payload')

    const { data: booking } = await admin
      .from('lalamove_bookings')
      .select('id, order_id, reseller_id')
      .eq('lalamove_order_id', lalamoveOrderId)
      .not('status', 'in', '(cancelled,failed)')
      .maybeSingle()

    // Log every inbound event for audit, whether or not we can match/verify it.
    await admin.from('lalamove_webhook_events').insert({ lalamove_order_id: lalamoveOrderId, event_type: status || null, payload })

    if (!booking) {
      // Unknown/stale booking — acknowledge so Lalamove stops retrying, but do nothing.
      return new Response(JSON.stringify({ ok: true, skipped: 'UNKNOWN_BOOKING' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const { data: order } = await admin.from('orders').select('delivery_quote_account_id').eq('id', booking.order_id).maybeSingle()
    const { data: cred } = order?.delivery_quote_account_id
      ? await admin.rpc('get_delivery_provider_credentials', { p_account_id: order.delivery_quote_account_id })
      : { data: null }
    const signatureHeader = req.headers.get(SIGNATURE_HEADER) || ''
    if (cred?.api_secret) {
      const expected = await hmacSha256Hex(cred.api_secret, rawBody)
      if (!signatureHeader || !timingSafeEqual(expected, signatureHeader)) {
        throw new Error('INVALID_WEBHOOK_SIGNATURE')
      }
    }

    const mappedStatus = mapLalamoveStatus(status)
    if (mappedStatus) {
      await admin
        .from('lalamove_bookings')
        .update({ status: mappedStatus, driver_info: driverInfo, updated_at: new Date().toISOString() })
        .eq('id', booking.id)
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    // Still 200 unrecognized/unverifiable payloads that aren't security
    // failures would otherwise cause Lalamove to retry indefinitely; but a
    // signature failure should surface as an error for investigation.
    const status = error.message === 'INVALID_WEBHOOK_SIGNATURE' ? 401 : 400
    return new Response(JSON.stringify({ error: error.message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})

// VERIFY: exact Lalamove status enum values against live docs.
function mapLalamoveStatus(raw: string | undefined): string | null {
  switch ((raw || '').toUpperCase()) {
    case 'ASSIGNING_DRIVER':
      return 'assigning_driver'
    case 'ON_GOING':
      return 'on_going'
    case 'PICKED_UP':
      return 'picked_up'
    case 'COMPLETED':
      return 'completed'
    case 'CANCELED':
    case 'CANCELLED':
    case 'REJECTED':
      return 'cancelled'
    default:
      return null
  }
}
