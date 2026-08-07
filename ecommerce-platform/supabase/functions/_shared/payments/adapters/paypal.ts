// PayPal adapter — Orders v2 API (https://developer.paypal.com/docs/api/orders/v2).
// credentials shape (named secrets set via Admin -> Integrations -> PayPal,
// same convention as every other integration_configs row):
//   { client_id: string, client_secret: string, webhook_id: string, sandbox?: boolean }
//
// VERIFY against a real PayPal sandbox account before enabling in
// production — same caveat as every other adapter here.
//
// Structurally different from every other adapter in this codebase in two
// ways PayPal itself requires: (1) OAuth2 client-credentials token exchange
// on every call (no long-lived API key), and (2) webhook verification is a
// live API call to PayPal's own verify-webhook-signature endpoint rather
// than a local HMAC recompute — PayPal does not publish a signing secret
// you can hash against yourself, it verifies on its own servers instead.
// An Orders v2 order is created but NOT captured here — createIntent's
// redirectUrl sends the buyer to PayPal's approval page; the actual money
// movement happens when the calling edge function's webhook handler
// receives CHECKOUT.ORDER.APPROVED and calls capture(), the same
// create-then-webhook-confirms shape every other provider here uses.

import type { PaymentProviderAdapter, OrderRef, IntentResult, RefundResult } from '../types.ts'

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

export const paypalAdapter: PaymentProviderAdapter = {
  code: 'payments.paypal',

  async createIntent(order: OrderRef, credentials: unknown): Promise<IntentResult> {
    const creds = credentials as PaypalCredentials
    if (!creds?.client_id || !creds?.client_secret) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'PayPal client id/secret is not configured', retryable: false } }
    }
    const siteUrl = Deno.env.get('SITE_URL') || 'https://tindahub-marketplace.vercel.app'
    try {
      const accessToken = await getAccessToken(creds)
      const res = await fetch(`${baseUrl(creds.sandbox)}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            { reference_id: order.orderId, amount: { currency_code: order.currency || 'PHP', value: order.amount.toFixed(2) } },
          ],
          application_context: {
            brand_name: 'JOM HUB',
            user_action: 'PAY_NOW',
            return_url: `${siteUrl}/wallet?paypal=success`,
            cancel_url: `${siteUrl}/wallet?paypal=cancelled`,
          },
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.message || body?.details?.[0]?.description || `PayPal returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'PAYPAL_API_ERROR', message, retryable: res.status >= 500 } }
      }
      const approveLink = (body?.links || []).find((l: { rel: string; href: string }) => l.rel === 'approve')?.href
      if (!body?.id || !approveLink) {
        return { ok: false, raw: body, error: { code: 'UNEXPECTED_RESPONSE_SHAPE', message: 'PayPal response was missing id/approve link', retryable: false } }
      }
      return { ok: true, externalRef: body.id, redirectUrl: approveLink, raw: body }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown network error'
      const code = message === 'PAYPAL_AUTH_FAILED' ? 'MISSING_CREDENTIALS' : 'NETWORK_ERROR'
      return { ok: false, error: { code, message, retryable: code === 'NETWORK_ERROR' } }
    }
  },

  // PayPal verification is itself a live API call (POST
  // /v1/notifications/verify-webhook-signature with the transmission
  // headers + raw event body + webhook_id), not a local hash comparison —
  // webhookSecret here is repurposed to carry the configured webhook_id
  // (the calling edge function passes credConfig.credentials.webhook_id),
  // matching the existing PaymentProviderAdapter contract shape rather than
  // widening it just for PayPal's one-off model.
  async verifyWebhook(headers: Headers, rawBody: string, webhookSecret: string): Promise<boolean> {
    if (!webhookSecret) return false
    const transmissionId = headers.get('paypal-transmission-id')
    const transmissionTime = headers.get('paypal-transmission-time')
    const certUrl = headers.get('paypal-cert-url')
    const authAlgo = headers.get('paypal-auth-algo')
    const transmissionSig = headers.get('paypal-transmission-sig')
    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return false
    // NOTE: needs the same client_id/secret used to create the order to get
    // an access token — the calling webhook handler is expected to fetch
    // get_integration_credentials('payments.paypal') for this, same as
    // every other step, so this function alone can't complete verification
    // without those. VERIFY: PayPal's verify-webhook-signature response
    // shape (`verification_status: "SUCCESS"`) against a live sandbox event.
    return false // placeholder guard — see paypal-webhook/index.ts for the real call, documented there
  },

  async refund(externalRef: string, amount: number, credentials: unknown): Promise<RefundResult> {
    const creds = credentials as PaypalCredentials
    if (!creds?.client_id || !creds?.client_secret) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'PayPal client id/secret is not configured', retryable: false } }
    }
    // NOTE: PayPal refunds are created against a Capture id, not an Order
    // id — externalRef here must be the capture id from
    // PAYMENT.CAPTURE.COMPLETED (stored in payment_intents.raw_payload),
    // same id-mismatch caveat every other adapter's refund() documents. Not
    // yet wired to any UI action.
    try {
      const accessToken = await getAccessToken(creds)
      const res = await fetch(`${baseUrl(creds.sandbox)}/v2/payments/captures/${encodeURIComponent(externalRef)}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: { currency_code: 'PHP', value: amount.toFixed(2) } }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.message || `PayPal returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'PAYPAL_API_ERROR', message, retryable: res.status >= 500 } }
      }
      return { ok: true, externalRefundId: body?.id, raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },
}
