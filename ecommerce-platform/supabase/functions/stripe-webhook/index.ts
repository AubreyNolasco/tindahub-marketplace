import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/payments/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-jomhub-device-id' }

// Public endpoint Stripe calls with checkout session status updates.
// Mirrors paymongo-webhook/index.ts's shape exactly — same "only ever
// touches topup_requests.status" posture, handle_topup_approved() does
// the actual wallet crediting.
//
// VERIFY the event type strings below (checkout.session.completed /
// .async_payment_failed / .expired) and the nested data path against a
// real Stripe webhook delivery before enabling — matches Stripe's docs
// at write time, never exercised against a live test event. Same
// caveat as every other webhook handler in this codebase.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'payments.stripe' })
    if (!credConfig) {
      // Integration got disabled after this webhook was registered on
      // Stripe's side — acknowledge so Stripe stops retrying, do nothing.
      return new Response(JSON.stringify({ ok: true, skipped: 'INTEGRATION_DISABLED' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    const webhookSecret = credConfig.credentials?.webhook_secret
    const verified = await getAdapter('payments.stripe').verifyWebhook(req.headers, rawBody, webhookSecret)
    if (!verified) {
      await admin.rpc('log_integration_event', {
        p_integration_key: 'payments.stripe',
        p_direction: 'inbound',
        p_event_type: 'webhook',
        p_status: 'error',
        p_payload: payload,
        p_error_message: 'INVALID_WEBHOOK_SIGNATURE',
      })
      throw new Error('INVALID_WEBHOOK_SIGNATURE')
    }

    const eventType: string = payload?.type || ''
    const session = payload?.data?.object || {}
    const sessionId: string | undefined = session?.id
    if (!sessionId) throw new Error('MISSING_CHECKOUT_SESSION_ID')

    const { data: intent } = await admin
      .from('payment_intents')
      .select('id, topup_request_id, status')
      .eq('provider_key', 'payments.stripe')
      .eq('external_ref', sessionId)
      .maybeSingle()

    await admin.rpc('log_integration_event', {
      p_integration_key: 'payments.stripe',
      p_direction: 'inbound',
      p_event_type: eventType || 'webhook',
      p_status: 'success',
      p_payload: { session_id: sessionId, matched: !!intent },
    })

    if (!intent) {
      // Unknown/stale session — acknowledge so Stripe stops retrying, do nothing.
      return new Response(JSON.stringify({ ok: true, skipped: 'UNKNOWN_SESSION' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (intent.status !== 'pending') {
      // Already processed (webhook redelivery) — acknowledge without reprocessing.
      return new Response(JSON.stringify({ ok: true, skipped: 'ALREADY_PROCESSED' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // session.payment_intent (a `pi_...` id) is what refund() needs later —
    // stored in raw_payload since payment_intents.external_ref stays the
    // checkout session id for lookup-by-session on redelivery.
    if (eventType === 'checkout.session.completed' && session.payment_status === 'paid') {
      await admin.from('payment_intents').update({ status: 'paid', raw_payload: payload, updated_at: new Date().toISOString() }).eq('id', intent.id)
      // Same update an admin's Approve button performs in TopupRequests.jsx —
      // handle_topup_approved() picks it up from here.
      await admin
        .from('topup_requests')
        .update({ status: 'approved', admin_notes: 'Auto-approved via Stripe', reviewed_at: new Date().toISOString() })
        .eq('id', intent.topup_request_id)
    } else if (eventType === 'checkout.session.async_payment_failed' || eventType === 'checkout.session.expired') {
      const status = eventType === 'checkout.session.expired' ? 'expired' : 'failed'
      await admin.from('payment_intents').update({ status, raw_payload: payload, updated_at: new Date().toISOString() }).eq('id', intent.id)
      await admin
        .from('topup_requests')
        .update({ status: 'rejected', admin_notes: `Stripe payment ${status}`, reviewed_at: new Date().toISOString() })
        .eq('id', intent.topup_request_id)
    }
    // Any other event type for a known session (e.g. checkout.session.completed
    // with payment_status !== 'paid', an async payment method still pending):
    // acknowledged, no state change until the terminal event arrives.

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    const status = error.message === 'INVALID_WEBHOOK_SIGNATURE' ? 401 : 400
    return new Response(JSON.stringify({ error: error.message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
