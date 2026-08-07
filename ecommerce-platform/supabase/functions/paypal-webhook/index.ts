import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' }

interface PaypalCredentials {
  client_id: string
  client_secret: string
  webhook_id?: string
  sandbox?: boolean
}

function baseUrl(sandbox: boolean | undefined): string {
  return sandbox === false ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

async function getAccessToken(creds: PaypalCredentials): Promise<string> {
  const res = await fetch(`${baseUrl(creds.sandbox)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${creds.client_id}:${creds.client_secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const body = await res.json()
  if (!res.ok || !body?.access_token) throw new Error(body?.error_description || 'PAYPAL_AUTH_FAILED')
  return body.access_token
}

// PayPal's verification is itself a live API call, not a local hash compare
// (see adapters/paypal.ts's verifyWebhook, which is a deliberate placeholder —
// this is "the real call, documented there"). Ref:
// https://developer.paypal.com/api/rest/webhooks/rest/#link-verifywebhooksignature
async function verifyPaypalWebhook(accessToken: string, sandbox: boolean | undefined, webhookId: string, headers: Headers, rawBody: string): Promise<boolean> {
  const transmissionId = headers.get('paypal-transmission-id')
  const transmissionTime = headers.get('paypal-transmission-time')
  const certUrl = headers.get('paypal-cert-url')
  const authAlgo = headers.get('paypal-auth-algo')
  const transmissionSig = headers.get('paypal-transmission-sig')
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig || !webhookId) return false

  const res = await fetch(`${baseUrl(sandbox)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  })
  if (!res.ok) return false
  const body = await res.json()
  return body?.verification_status === 'SUCCESS'
}

// Public endpoint PayPal calls with order/capture status updates. Two
// events matter here: CHECKOUT.ORDER.APPROVED (buyer approved on PayPal's
// page — the order must still be CAPTURED server-side, PayPal does not
// move money on approval alone) and PAYMENT.CAPTURE.COMPLETED/.DENIED
// (the actual money-movement result). Mirrors paymongo-webhook/index.ts's
// "only ever touches topup_requests.status" posture otherwise —
// handle_topup_approved() does the actual wallet crediting.
//
// VERIFY the event type strings and nested resource paths below against a
// real PayPal sandbox webhook delivery before enabling — matches PayPal's
// Orders v2 / Webhooks docs at write time, never exercised live. Same
// caveat as every other webhook handler in this codebase.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'payments.paypal' })
    if (!credConfig) {
      // Integration got disabled after this webhook was registered on
      // PayPal's side — acknowledge so PayPal stops retrying, do nothing.
      return new Response(JSON.stringify({ ok: true, skipped: 'INTEGRATION_DISABLED' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    const creds = credConfig.credentials as PaypalCredentials
    const accessToken = await getAccessToken(creds)
    const verified = await verifyPaypalWebhook(accessToken, creds.sandbox, creds.webhook_id || '', req.headers, rawBody)
    if (!verified) {
      await admin.rpc('log_integration_event', {
        p_integration_key: 'payments.paypal',
        p_direction: 'inbound',
        p_event_type: 'webhook',
        p_status: 'error',
        p_payload: payload,
        p_error_message: 'INVALID_WEBHOOK_SIGNATURE',
      })
      throw new Error('INVALID_WEBHOOK_SIGNATURE')
    }

    const eventType: string = payload?.event_type || ''
    const resource = payload?.resource || {}
    // CHECKOUT.ORDER.APPROVED: resource.id is the order id (matches
    // payment_intents.external_ref from paypal-create-intent).
    // PAYMENT.CAPTURE.COMPLETED/.DENIED: resource.supplementary_data
    // .related_ids.order_id is the same order id; resource.id there is the
    // capture id instead (needed later for refund()).
    const orderId: string | undefined = eventType.startsWith('CHECKOUT.ORDER')
      ? resource?.id
      : resource?.supplementary_data?.related_ids?.order_id
    if (!orderId) throw new Error('MISSING_ORDER_ID')

    const { data: intent } = await admin
      .from('payment_intents')
      .select('id, topup_request_id, status')
      .eq('provider_key', 'payments.paypal')
      .eq('external_ref', orderId)
      .maybeSingle()

    await admin.rpc('log_integration_event', {
      p_integration_key: 'payments.paypal',
      p_direction: 'inbound',
      p_event_type: eventType || 'webhook',
      p_status: 'success',
      p_payload: { order_id: orderId, matched: !!intent },
    })

    if (!intent) {
      // Unknown/stale order — acknowledge so PayPal stops retrying, do nothing.
      return new Response(JSON.stringify({ ok: true, skipped: 'UNKNOWN_ORDER' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (intent.status !== 'pending') {
      // Already processed (webhook redelivery) — acknowledge without reprocessing.
      return new Response(JSON.stringify({ ok: true, skipped: 'ALREADY_PROCESSED' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      // Buyer approved but no money has moved yet — capture the order now.
      // This is the one step every other provider's adapter does inside
      // createIntent/webhook automatically via a hosted checkout; PayPal's
      // Orders v2 API splits approve and capture into two calls on purpose.
      const captureRes = await fetch(`${baseUrl(creds.sandbox)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      })
      const captureBody = await captureRes.json()
      const captureStatus = captureBody?.status
      await admin.rpc('log_integration_event', {
        p_integration_key: 'payments.paypal',
        p_direction: 'outbound',
        p_event_type: 'capture_order',
        p_status: captureRes.ok && captureStatus === 'COMPLETED' ? 'success' : 'error',
        p_payload: { order_id: orderId, capture_status: captureStatus },
        p_error_message: captureRes.ok ? null : (captureBody?.message || `PayPal capture returned HTTP ${captureRes.status}`),
      })
      if (captureRes.ok && captureStatus === 'COMPLETED') {
        await admin.from('payment_intents').update({ status: 'paid', raw_payload: captureBody, updated_at: new Date().toISOString() }).eq('id', intent.id)
        // Same update an admin's Approve button performs in TopupRequests.jsx —
        // handle_topup_approved() picks it up from here.
        await admin
          .from('topup_requests')
          .update({ status: 'approved', admin_notes: 'Auto-approved via PayPal', reviewed_at: new Date().toISOString() })
          .eq('id', intent.topup_request_id)
      } else {
        await admin.from('payment_intents').update({ status: 'failed', raw_payload: captureBody, updated_at: new Date().toISOString() }).eq('id', intent.id)
        await admin
          .from('topup_requests')
          .update({ status: 'rejected', admin_notes: 'PayPal capture failed', reviewed_at: new Date().toISOString() })
          .eq('id', intent.topup_request_id)
      }
    } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      // Redundant confirmation for the common path (capture already applied
      // above on ORDER.APPROVED) but the authoritative source if that
      // synchronous capture call above ever fails to log/update for any reason.
      await admin.from('payment_intents').update({ status: 'paid', raw_payload: payload, updated_at: new Date().toISOString() }).eq('id', intent.id)
      await admin
        .from('topup_requests')
        .update({ status: 'approved', admin_notes: 'Auto-approved via PayPal', reviewed_at: new Date().toISOString() })
        .eq('id', intent.topup_request_id)
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'CHECKOUT.ORDER.VOIDED') {
      await admin.from('payment_intents').update({ status: 'failed', raw_payload: payload, updated_at: new Date().toISOString() }).eq('id', intent.id)
      await admin
        .from('topup_requests')
        .update({ status: 'rejected', admin_notes: `PayPal payment ${eventType}`, reviewed_at: new Date().toISOString() })
        .eq('id', intent.topup_request_id)
    }
    // Any other event type for a known order: acknowledged, no state change.

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    const status = error.message === 'INVALID_WEBHOOK_SIGNATURE' ? 401 : 400
    return new Response(JSON.stringify({ error: error.message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
