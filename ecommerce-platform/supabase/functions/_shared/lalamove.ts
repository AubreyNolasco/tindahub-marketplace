// Shared Lalamove REST v3 client used by lalamove-quote, lalamove-book and
// lalamove-webhook. Implemented against the documented Lalamove API v3
// contract (HMAC-signed requests, JSON:API-style { data: ... } envelopes).
//
// *** NOT LIVE-TESTED — no sandbox account was available while writing this.
// Before enabling this for real resellers, verify against a real Lalamove
// sandbox account: exact field names for stops/sender/recipients, the
// `Market` header values (PH vs city codes like PH_MNL), and the webhook
// signature header name (marked below with VERIFY comments). ***

const SANDBOX_BASE = 'https://rest.sandbox.lalamove.com'
const PRODUCTION_BASE = 'https://rest.lalamove.com'

export function lalamoveBaseUrl(): string {
  return Deno.env.get('LALAMOVE_ENV') === 'production' ? PRODUCTION_BASE : SANDBOX_BASE
}

// Stored market values look like 'PH_MNL' / 'PH_CEB' (city-scoped). The
// Lalamove `Market` header is documented as the country code (e.g. 'PH').
// VERIFY: confirm whether the city portion is needed anywhere else
// (e.g. serviceType selection) once a real sandbox account is available.
export function countryMarket(storedMarket: string | null | undefined): string {
  const value = (storedMarket || 'PH_MNL').split('_')[0].toUpperCase()
  return value || 'PH'
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Authorization: hmac <apiKey>:<timestamp>:<signature>
// signature = HMAC-SHA256(apiSecret, `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`)
async function signRequest(apiKey: string, apiSecret: string, method: string, path: string, body: string) {
  const timestamp = Date.now().toString()
  const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`
  const signature = await hmacSha256Hex(apiSecret, rawSignature)
  return { timestamp, authorization: `hmac ${apiKey}:${timestamp}:${signature}` }
}

export class LalamoveApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super(`Lalamove API error (${status}): ${JSON.stringify(body)}`)
    this.status = status
    this.body = body
  }
}

export async function lalamoveRequest(opts: {
  apiKey: string
  apiSecret: string
  market: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: Record<string, unknown>
}) {
  const bodyStr = opts.body ? JSON.stringify(opts.body) : ''
  const { authorization } = await signRequest(opts.apiKey, opts.apiSecret, opts.method, opts.path, bodyStr)
  const res = await fetch(`${lalamoveBaseUrl()}${opts.path}`, {
    method: opts.method,
    headers: {
      Authorization: authorization,
      Market: opts.market,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
    },
    body: bodyStr || undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new LalamoveApiError(res.status, json)
  return json
}

export type LalamoveStop = { lat: number; lng: number; address: string }

// VERIFY: exact quotation request/response field names against live docs.
export async function requestQuotation(opts: {
  apiKey: string
  apiSecret: string
  market: string
  pickup: LalamoveStop
  dropoff: LalamoveStop
  serviceType?: string
}) {
  const json = await lalamoveRequest({
    apiKey: opts.apiKey,
    apiSecret: opts.apiSecret,
    market: opts.market,
    method: 'POST',
    path: '/v3/quotations',
    body: {
      data: {
        serviceType: opts.serviceType || 'MOTORCYCLE',
        language: 'en_PH',
        stops: [
          { coordinates: { lat: String(opts.pickup.lat), lng: String(opts.pickup.lng) }, address: opts.pickup.address },
          { coordinates: { lat: String(opts.dropoff.lat), lng: String(opts.dropoff.lng) }, address: opts.dropoff.address },
        ],
        isRouteOptimized: true,
      },
    },
  })

  const data = json?.data
  return {
    quotationId: data?.quotationId as string | undefined,
    priceTotal: data?.priceBreakdown?.total as string | undefined,
    currency: data?.priceBreakdown?.currency as string | undefined,
    pickupStopId: data?.stops?.[0]?.stopId as string | undefined,
    dropoffStopId: data?.stops?.[1]?.stopId as string | undefined,
    raw: json,
  }
}

// VERIFY: exact place-order request/response field names against live docs.
export async function placeOrder(opts: {
  apiKey: string
  apiSecret: string
  market: string
  quotationId: string
  pickupStopId: string
  dropoffStopId: string
  senderName: string
  senderPhone: string
  recipientName: string
  recipientPhone: string
  orderId: string
}) {
  const json = await lalamoveRequest({
    apiKey: opts.apiKey,
    apiSecret: opts.apiSecret,
    market: opts.market,
    method: 'POST',
    path: '/v3/orders',
    body: {
      data: {
        quotationId: opts.quotationId,
        sender: { stopId: opts.pickupStopId, name: opts.senderName, phone: opts.senderPhone },
        recipients: [{ stopId: opts.dropoffStopId, name: opts.recipientName, phone: opts.recipientPhone }],
        isPODEnabled: false,
        metadata: { jomhub_order_id: opts.orderId },
      },
    },
  })

  const data = json?.data
  return {
    lalamoveOrderId: data?.orderId as string | undefined,
    status: data?.status as string | undefined,
    shareLink: data?.shareLink as string | undefined,
    raw: json,
  }
}
