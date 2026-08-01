// Delivery Provider Engine — shared contract every courier adapter
// implements. Kept intentionally small: getTracking/cancelBooking are
// added when the tracking/cancellation phases are actually built, not
// stubbed out now.

export interface DeliveryStop {
  lat: number
  lng: number
  address: string
  name?: string
  phone?: string
}

export interface QuoteInput {
  pickup: DeliveryStop
  dropoff: DeliveryStop
}

export interface QuoteResult {
  ok: boolean
  externalQuoteId?: string
  fee?: number
  currency?: string
  raw?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export interface BookingInput {
  orderId: string
  pickup: DeliveryStop
  dropoff: DeliveryStop
}

export interface BookingResult {
  ok: boolean
  externalOrderId?: string
  trackingNumber?: string
  shareLink?: string
  raw?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export interface DeliveryProviderAdapter {
  code: string
  getQuote(input: QuoteInput, credentials: unknown): Promise<QuoteResult>
  createBooking(input: BookingInput, credentials: unknown): Promise<BookingResult>
}
