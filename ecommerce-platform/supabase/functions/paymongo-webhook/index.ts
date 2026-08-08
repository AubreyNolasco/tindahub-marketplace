import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/payments/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-jomhub-device-id' }

// Public endpoint PayMongo calls with checkout session status updates.
// Deliberately touches ONLY topup_requests.status — the existing
// handle_topup_approved() trigger (topup_wallet_migration.sql) is what
// actually credits the wallet, exactly as it does for a manual admin
// approval in TopupRequests.jsx. This function never credits a wallet
// itself, so there is exactly one place wallet-crediting logic lives.
//
// VERIFY the event type strings below (checkout_session.payment.paid /
// .failed) and the nested data path against a real PayMongo webhook
// delivery before enabling — matches the payload shape published in
// PayMongo's docs at write time but was never exercised against a live
// sandbox event. Same caveat as lalamove-webhook/index.ts.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'payments.paymongo' })
    if (!credConfig) {
      // Integration got disabled after this webhook was registered on
      // PayMongo's side — acknowledge so PayMongo stops retrying, do nothing.
      return new Response(JSON.stringify({ ok: true, skipped: 'INTEGRATION_DISABLED' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    const webhookSecret = credConfig.credentials?.webhook_secret
    const verified = await getAdapter('payments.paymongo').verifyWebhook(req.headers, rawBody, webhookSecret)
    if (!verified) {
      await admin.rpc('log_integration_event', {
        p_integration_key: 'payments.paymongo',
        p_direction: 'inbound',
        p_event_type: 'webhook',
        p_status: 'error',
        p_payload: payload,
        p_error_message: 'INVALID_WEBHOOK_SIGNATURE',
      })
      throw new Error('INVALID_WEBHOOK_SIGNATURE')
    }

    const eventType: string = payload?.data?.attributes?.type || ''
    const sessionId: string | undefined = payload?.data?.attributes?.data?.id
    if (!sessionId) throw new Error('MISSING_CHECKOUT_SESSION_ID')

    const { data: intent } = await admin
      .from('payment_intents')
      .select('id, topup_request_id, status')
      .eq('provider_key', 'payments.paymongo')
      .eq('external_ref', sessionId)
      .maybeSingle()

    await admin.rpc('log_integration_event', {
      p_integration_key: 'payments.paymongo',
      p_direction: 'inbound',
      p_event_type: eventType || 'webhook',
      p_status: 'success',
      p_payload: { session_id: sessionId, matched: !!intent },
    })

    if (!intent) {
      // Unknown/stale session — acknowledge so PayMongo stops retrying, do nothing.
      return new Response(JSON.stringify({ ok: true, skipped: 'UNKNOWN_SESSION' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (intent.status !== 'pending') {
      // Already processed (webhook redelivery) — acknowledge without reprocessing.
      return new Response(JSON.stringify({ ok: true, skipped: 'ALREADY_PROCESSED' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (eventType.includes('paid')) {
      await admin.from('payment_intents').update({ status: 'paid', raw_payload: payload, updated_at: new Date().toISOString() }).eq('id', intent.id)
      // Same update an admin's Approve button performs in TopupRequests.jsx —
      // handle_topup_approved() picks it up from here.
      await admin
        .from('topup_requests')
        .update({ status: 'approved', admin_notes: 'Auto-approved via PayMongo', reviewed_at: new Date().toISOString() })
        .eq('id', intent.topup_request_id)
    } else if (eventType.includes('failed') || eventType.includes('expired')) {
      const status = eventType.includes('expired') ? 'expired' : 'failed'
      await admin.from('payment_intents').update({ status, raw_payload: payload, updated_at: new Date().toISOString() }).eq('id', intent.id)
      await admin
        .from('topup_requests')
        .update({ status: 'rejected', admin_notes: `PayMongo payment ${status}`, reviewed_at: new Date().toISOString() })
        .eq('id', intent.topup_request_id)
    }
    // Any other event type for a known session: acknowledged, no state change.

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    const status = error.message === 'INVALID_WEBHOOK_SIGNATURE' ? 401 : 400
    return new Response(JSON.stringify({ error: error.message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
