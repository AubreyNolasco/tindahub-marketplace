// Stripe adapter — Checkout Sessions API (https://stripe.com/docs/api/checkout/sessions).
// credentials shape (named secrets set via Admin -> Integrations -> Stripe,
// same convention as every other integration_configs row):
//   { secret_key: string, publishable_key?: string, webhook_secret: string }
//
// VERIFY against a real Stripe test-mode account before enabling in
// production — field names below match Stripe's stable, versioned API
// (same shape for years), but was never exercised against a live test call
// in this codebase, same caveat as every other adapter here.

import type { PaymentProviderAdapter, OrderRef, IntentResult, RefundResult } from '../types.ts'

interface StripeCredentials {
  secret_key: string
  webhook_secret?: string
}

const API_BASE = 'https://api.stripe.com/v1'

function formBody(fields: Record<string, string | number>): string {
  return Object.entries(fields).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
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

export const stripeAdapter: PaymentProviderAdapter = {
  code: 'payments.stripe',

  // Stripe's REST API is form-encoded, not JSON — unlike every other
  // adapter in this codebase. client_reference_id round-trips order.orderId
  // back on the webhook event for correlation, mirroring how PayMongo uses
  // reference_number and Maya uses requestReferenceNumber.
  async createIntent(order: OrderRef, credentials: unknown): Promise<IntentResult> {
    const creds = credentials as StripeCredentials
    if (!creds?.secret_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Stripe secret key is not configured', retryable: false } }
    }
    const siteUrl = Deno.env.get('SITE_URL') || 'https://tindahub-marketplace.vercel.app'
    try {
      const res = await fetch(`${API_BASE}/checkout/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody({
          mode: 'payment',
          'payment_method_types[0]': 'card',
          'line_items[0][price_data][currency]': (order.currency || 'PHP').toLowerCase(),
          'line_items[0][price_data][product_data][name]': 'JOM HUB wallet top-up',
          'line_items[0][price_data][unit_amount]': Math.round(order.amount * 100),
          'line_items[0][quantity]': 1,
          client_reference_id: order.orderId,
          success_url: `${siteUrl}/wallet?stripe=success`,
          cancel_url: `${siteUrl}/wallet?stripe=cancelled`,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.error?.message || `Stripe returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'STRIPE_API_ERROR', message, retryable: res.status >= 500 } }
      }
      if (!body?.id || !body?.url) {
        return { ok: false, raw: body, error: { code: 'UNEXPECTED_RESPONSE_SHAPE', message: 'Stripe response was missing id/url', retryable: false } }
      }
      return { ok: true, externalRef: body.id, redirectUrl: body.url, raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },

  // Stripe-Signature: t=<timestamp>,v1=<hex hmac-sha256 of "${t}.${rawBody}">
  // — Stripe's own documented scheme, structurally identical to PayMongo's
  // (both timestamp-prefixed HMAC-SHA256), just a different header name/shape.
  async verifyWebhook(headers: Headers, rawBody: string, webhookSecret: string): Promise<boolean> {
    const sigHeader = headers.get('stripe-signature') || ''
    if (!sigHeader || !webhookSecret) return false
    const parts = Object.fromEntries(sigHeader.split(',').map((part) => part.split('=')))
    const timestamp = parts.t
    const v1 = parts.v1
    if (!timestamp || !v1) return false
    const expected = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`)
    return timingSafeEqual(expected, v1)
  },

  async refund(externalRef: string, amount: number, credentials: unknown): Promise<RefundResult> {
    const creds = credentials as StripeCredentials
    if (!creds?.secret_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Stripe secret key is not configured', retryable: false } }
    }
    // NOTE: Stripe refunds are created against a PaymentIntent id, not a
    // Checkout Session id — externalRef here must be the payment_intent
    // captured from the checkout.session.completed webhook event (stored in
    // payment_intents.raw_payload), same caveat PayMongo's refund() has for
    // its own session-vs-payment id distinction. Not yet wired to any UI
    // action — implemented for interface completeness.
    try {
      const res = await fetch(`${API_BASE}/refunds`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.secret_key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody({ payment_intent: externalRef, amount: Math.round(amount * 100) }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.error?.message || `Stripe returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'STRIPE_API_ERROR', message, retryable: res.status >= 500 } }
      }
      return { ok: true, externalRefundId: body?.id, raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },
}
