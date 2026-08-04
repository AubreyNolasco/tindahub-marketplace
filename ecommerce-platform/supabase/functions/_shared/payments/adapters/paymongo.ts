// PayMongo adapter — Checkout Sessions API (https://developers.paymongo.com).
// credentials shape (named secrets set via Admin -> Integrations ->
// PayMongo, same convention as every other integration_configs row):
//   { secret_key: string, public_key?: string }
//
// VERIFY against a real PayMongo sandbox account before enabling in
// production, same convention as lalamove-webhook/index.ts: the request/
// response field names below match PayMongo's published API docs at
// write time, but were never exercised against a live sandbox call.

import type { PaymentProviderAdapter, OrderRef, IntentResult, RefundResult } from '../types.ts'

interface PaymongoCredentials {
  secret_key: string
  public_key?: string
}

const API_BASE = 'https://api.paymongo.com/v1'

function basicAuthHeader(secretKey: string): string {
  return `Basic ${btoa(`${secretKey}:`)}`
}

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

export const paymongoAdapter: PaymentProviderAdapter = {
  code: 'payments.paymongo',

  // Creates a hosted Checkout Session and returns its URL. order.orderId
  // is passed through as PayMongo's reference_number so it round-trips
  // back on the webhook payload for correlation, but the caller (edge
  // function) is the one that actually persists the topup_requests <->
  // checkout-session mapping in payment_intents — this adapter only
  // talks to PayMongo, it never touches the database.
  async createIntent(order: OrderRef, credentials: unknown): Promise<IntentResult> {
    const creds = credentials as PaymongoCredentials
    if (!creds?.secret_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'PayMongo secret key is not configured', retryable: false } }
    }
    const siteUrl = Deno.env.get('SITE_URL') || 'https://tindahub-marketplace.vercel.app'
    try {
      const res = await fetch(`${API_BASE}/checkout_sessions`, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(creds.secret_key),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          data: {
            attributes: {
              send_email_receipt: false,
              show_description: true,
              show_line_items: true,
              line_items: [
                { amount: Math.round(order.amount * 100), currency: order.currency || 'PHP', name: 'JOM HUB wallet top-up', quantity: 1 },
              ],
              payment_method_types: ['gcash', 'card', 'paymaya'],
              description: 'JOM HUB wallet top-up',
              reference_number: order.orderId,
              success_url: `${siteUrl}/wallet?paymongo=success`,
              cancel_url: `${siteUrl}/wallet?paymongo=cancelled`,
            },
          },
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.errors?.[0]?.detail || `PayMongo returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'PAYMONGO_API_ERROR', message, retryable: res.status >= 500 } }
      }
      const checkoutUrl = body?.data?.attributes?.checkout_url
      const sessionId = body?.data?.id
      if (!checkoutUrl || !sessionId) {
        return { ok: false, raw: body, error: { code: 'UNEXPECTED_RESPONSE_SHAPE', message: 'PayMongo response was missing checkout_url/id', retryable: false } }
      }
      return { ok: true, externalRef: sessionId, redirectUrl: checkoutUrl, raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },

  // PayMongo signs webhooks with `Paymongo-Signature: t=<timestamp>,te=<test-signature>,li=<live-signature>`.
  // Expected value is HMAC-SHA256 of `${t}.${rawBody}` using the webhook's signing secret,
  // hex-encoded. te is used in sandbox mode, li in production — this accepts either since
  // integration_configs.mode already tracks sandbox/production separately and a mismatch
  // here should fail closed either way.
  // VERIFY the header name/format against a live PayMongo webhook delivery before enabling.
  async verifyWebhook(headers: Headers, rawBody: string, webhookSecret: string): Promise<boolean> {
    const sigHeader = headers.get('paymongo-signature') || ''
    if (!sigHeader || !webhookSecret) return false
    const parts = Object.fromEntries(sigHeader.split(',').map((part) => part.split('=')))
    const timestamp = parts.t
    const testSig = parts.te
    const liveSig = parts.li
    if (!timestamp || (!testSig && !liveSig)) return false
    const expected = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`)
    return (!!testSig && timingSafeEqual(expected, testSig)) || (!!liveSig && timingSafeEqual(expected, liveSig))
  },

  async refund(externalRef: string, amount: number, credentials: unknown): Promise<RefundResult> {
    const creds = credentials as PaymongoCredentials
    if (!creds?.secret_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'PayMongo secret key is not configured', retryable: false } }
    }
    // NOTE: PayMongo refunds are created against a *payment* id, not a
    // checkout session id. externalRef here must be the payment id
    // captured from the checkout_session.payment.paid webhook event
    // (payment_intents.raw_payload), not payment_intents.external_ref
    // (which stores the session id). Not yet wired to any UI action —
    // implemented for interface completeness ahead of a future refund flow.
    try {
      const res = await fetch(`${API_BASE}/refunds`, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(creds.secret_key),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          data: { attributes: { amount: Math.round(amount * 100), payment_id: externalRef, reason: 'requested_by_customer' } },
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.errors?.[0]?.detail || `PayMongo returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'PAYMONGO_API_ERROR', message, retryable: res.status >= 500 } }
      }
      return { ok: true, externalRefundId: body?.data?.id, raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },
}
