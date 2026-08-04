// Payment Provider Engine — shared contract every gateway adapter
// implements. Mirrors _shared/delivery/types.ts. Kept intentionally
// small: refund() is included because every requested gateway supports
// it, but nothing gateway-specific (installments, saved cards, etc.) is
// added until an adapter actually needs it.

export interface OrderRef {
  orderId: string
  amount: number
  currency: string
}

export interface IntentResult {
  ok: boolean
  externalRef?: string
  redirectUrl?: string
  raw?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export interface RefundResult {
  ok: boolean
  externalRefundId?: string
  raw?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export interface PaymentProviderAdapter {
  code: string
  createIntent(order: OrderRef, credentials: unknown): Promise<IntentResult>
  // Promise, not boolean: every gateway's signature scheme (PayMongo's
  // HMAC-SHA256 included) goes through Web Crypto's crypto.subtle, which
  // is promise-based — a sync contract would force adapters to fake it.
  verifyWebhook(headers: Headers, rawBody: string, webhookSecret: string): Promise<boolean>
  refund(externalRef: string, amount: number, credentials: unknown): Promise<RefundResult>
}
