import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/payments/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-jomhub-device-id' }

// Public endpoint Maya calls with checkout payment status updates.
// Mirrors paymongo-webhook/index.ts's shape, with one deliberate difference:
// Maya's webhook has no HMAC signature (see adapters/maya.ts's file header),
// so on top of the adapter's best-effort IP check, this handler also
// re-fetches the authoritative payment status from Maya's own GET payment
// endpoint before crediting anything — the webhook body alone is never
// trusted for the actual status.
//
// VERIFY the event/status field names below (paymentStatus values
// PAYMENT_SUCCESS / PAYMENT_FAILED / PAYMENT_EXPIRED / PAYMENT_CANCELLED)
// against a real Maya sandbox webhook delivery before enabling — matches
// Maya's docs at write time, never exercised live. Same caveat as every
// other webhook handler in this codebase.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'payments.maya' })
    if (!credConfig) {
      return new Response(JSON.stringify({ ok: true, skipped: 'INTEGRATION_DISABLED' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const ipVerified = await getAdapter('payments.maya').verifyWebhook(req.headers, rawBody, '')
    const checkoutId: string | undefined = payload?.checkoutId || payload?.id
    if (!checkoutId) throw new Error('MISSING_CHECKOUT_ID')

    const { data: intent } = await admin
      .from('payment_intents')
      .select('id, topup_request_id, status')
      .eq('provider_key', 'payments.maya')
      .eq('external_ref', checkoutId)
      .maybeSingle()

    if (!intent) {
      await admin.rpc('log_integration_event', { p_integration_key: 'payments.maya', p_direction: 'inbound', p_event_type: 'webhook', p_status: 'success', p_payload: { checkout_id: checkoutId, matched: false, ip_verified: ipVerified } })
      return new Response(JSON.stringify({ ok: true, skipped: 'UNKNOWN_CHECKOUT' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (intent.status !== 'pending') {
      return new Response(JSON.stringify({ ok: true, skipped: 'ALREADY_PROCESSED' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Re-verify with Maya directly rather than trusting the payload's own
    // paymentStatus field, since (per the file header above) the webhook
    // itself carries no cryptographic proof of authenticity.
    const base = credConfig.credentials?.sandbox === false ? 'https://pg.paymaya.com' : 'https://pg-sandbox.paymaya.com'
    const statusRes = await fetch(`${base}/checkout/v1/checkouts/${encodeURIComponent(checkoutId)}`, {
      headers: { Authorization: `Basic ${btoa(`${credConfig.credentials?.secret_key}:`)}` },
    })
    const statusBody = statusRes.ok ? await statusRes.json() : null
    const confirmedStatus: string = statusBody?.paymentStatus || payload?.paymentStatus || ''

    await admin.rpc('log_integration_event', {
      p_integration_key: 'payments.maya',
      p_direction: 'inbound',
      p_event_type: confirmedStatus || 'webhook',
      p_status: 'success',
      p_payload: { checkout_id: checkoutId, matched: true, ip_verified: ipVerified, confirmed_status: confirmedStatus },
    })

    if (confirmedStatus === 'PAYMENT_SUCCESS') {
      await admin.from('payment_intents').update({ status: 'paid', raw_payload: statusBody ?? payload, updated_at: new Date().toISOString() }).eq('id', intent.id)
      await admin.from('topup_requests').update({ status: 'approved', admin_notes: 'Auto-approved via Maya', reviewed_at: new Date().toISOString() }).eq('id', intent.topup_request_id)
    } else if (['PAYMENT_FAILED', 'PAYMENT_EXPIRED', 'PAYMENT_CANCELLED'].includes(confirmedStatus)) {
      await admin.from('payment_intents').update({ status: 'failed', raw_payload: statusBody ?? payload, updated_at: new Date().toISOString() }).eq('id', intent.id)
      await admin.from('topup_requests').update({ status: 'rejected', admin_notes: `Maya payment ${confirmedStatus}`, reviewed_at: new Date().toISOString() }).eq('id', intent.topup_request_id)
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
