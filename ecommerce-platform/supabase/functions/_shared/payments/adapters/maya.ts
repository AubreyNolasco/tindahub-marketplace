// Maya (formerly PayMaya) adapter — Checkout API (https://developers.maya.ph).
// credentials shape (named secrets set via Admin -> Integrations -> Maya,
// same convention as every other integration_configs row):
//   { public_key: string, secret_key: string }
//
// VERIFY against a real Maya sandbox account before enabling in production,
// same convention as every other adapter in this codebase: field names below
// match Maya's published reference docs at write time
// (developers.maya.ph/reference/createv1checkout), never exercised against a
// live sandbox call.
//
// Unlike PayMongo/Stripe, Maya does NOT publish an HMAC webhook-signature
// scheme -- their own docs say webhook authenticity is established by IP
// allowlisting only (developers.maya.ph/reference/configuring-your-webhook-for-maya-checkout).
// verifyWebhook() below does a best-effort IP check, but IP headers on an
// edge function are only as trustworthy as the proxy in front of it, so this
// is deliberately weaker than PayMongo's HMAC check -- the calling edge
// function (maya-webhook, mirroring paymongo-webhook's shape) MUST treat this
// as a hint, not proof, and re-fetch the authoritative payment status from
// Maya's own GET payment endpoint (Basic auth w/ secret key) before crediting
// any wallet, the same "never trust the webhook body alone" posture a
// signature-less provider requires.

import type { PaymentProviderAdapter, OrderRef, IntentResult, RefundResult } from '../types.ts'

interface MayaCredentials {
  public_key: string
  secret_key: string
  sandbox?: boolean
}

function baseUrl(sandbox: boolean | undefined): string {
  return sandbox === false ? 'https://pg.paymaya.com' : 'https://pg-sandbox.paymaya.com'
}

function basicAuthHeader(apiKey: string): string {
  return `Basic ${btoa(`${apiKey}:`)}`
}

// Published in Maya's webhook-config docs; sandbox and production have
// separate address pairs. Not exhaustive (Maya doesn't guarantee this list
// is stable), hence the "hint, not proof" posture above.
const SANDBOX_IPS = ['13.229.160.234', '3.1.199.75']
const PRODUCTION_IPS = ['18.138.50.235', '3.1.207.200']

export const mayaAdapter: PaymentProviderAdapter = {
  code: 'payments.maya',

  async createIntent(order: OrderRef, credentials: unknown): Promise<IntentResult> {
    const creds = credentials as MayaCredentials
    if (!creds?.public_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Maya public key is not configured', retryable: false } }
    }
    const siteUrl = Deno.env.get('SITE_URL') || 'https://tindahub-marketplace.vercel.app'
    try {
      const res = await fetch(`${baseUrl(creds.sandbox)}/checkout/v1/checkouts`, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(creds.public_key),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          totalAmount: { value: Number(order.amount.toFixed(2)), currency: order.currency || 'PHP' },
          requestReferenceNumber: order.orderId.slice(0, 36),
          redirectUrl: {
            success: `${siteUrl}/wallet?maya=success`,
            failure: `${siteUrl}/wallet?maya=failed`,
            cancel: `${siteUrl}/wallet?maya=cancelled`,
          },
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.message || body?.error || `Maya returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'MAYA_API_ERROR', message, retryable: res.status >= 500 } }
      }
      if (!body?.checkoutId || !body?.redirectUrl) {
        return { ok: false, raw: body, error: { code: 'UNEXPECTED_RESPONSE_SHAPE', message: 'Maya response was missing checkoutId/redirectUrl', retryable: false } }
      }
      return { ok: true, externalRef: body.checkoutId, redirectUrl: body.redirectUrl, raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },

  // See file header -- best-effort IP check only. webhookSecret is accepted
  // to match the shared PaymentProviderAdapter contract (every other adapter
  // uses it for HMAC) but Maya has none to check against, so it's unused
  // here on purpose. Real trust comes from the calling edge function
  // re-querying Maya's GET payment endpoint, not from this function.
  async verifyWebhook(headers: Headers, _rawBody: string, _webhookSecret: string): Promise<boolean> {
    const forwardedFor = headers.get('x-forwarded-for') || headers.get('cf-connecting-ip') || ''
    const callerIp = forwardedFor.split(',')[0]?.trim()
    if (!callerIp) return false
    return SANDBOX_IPS.includes(callerIp) || PRODUCTION_IPS.includes(callerIp)
  },

  // VERIFY: Maya's refund endpoint (POST /payments/v1/payments/{id}/refunds,
  // Basic auth w/ secret key) per their Payment Vault API reference -- not
  // yet wired to any UI action, implemented for interface completeness
  // ahead of a future refund flow, same status as PayMongo's refund().
  async refund(externalRef: string, amount: number, credentials: unknown): Promise<RefundResult> {
    const creds = credentials as MayaCredentials
    if (!creds?.secret_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Maya secret key is not configured', retryable: false } }
    }
    try {
      const res = await fetch(`${baseUrl(creds.sandbox)}/payments/v1/payments/${encodeURIComponent(externalRef)}/refunds`, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(creds.secret_key),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ totalAmount: { value: Number(amount.toFixed(2)), currency: 'PHP' }, reason: 'requested_by_customer' }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.message || body?.error || `Maya returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'MAYA_API_ERROR', message, retryable: res.status >= 500 } }
      }
      return { ok: true, externalRefundId: body?.id, raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },
}
