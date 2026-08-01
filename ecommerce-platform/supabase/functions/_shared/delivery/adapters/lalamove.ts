// Wraps the existing Lalamove REST client (../../lalamove.ts) in the
// DeliveryProviderAdapter shape. The HTTP/signing logic itself is
// untouched — this only translates generic QuoteInput/BookingInput in
// and out of Lalamove's request/response fields.

import { requestQuotation, placeOrder, countryMarket, LalamoveApiError } from '../../lalamove.ts'
import type { DeliveryProviderAdapter, QuoteInput, QuoteResult, BookingInput, BookingResult } from '../types.ts'

export interface LalamoveCredentials {
  api_key: string
  api_secret: string
  market?: string | null
}

function isRetryable(error: unknown): boolean {
  // A rejected/invalid request (4xx) won't succeed on retry — a courier
  // outage or transient network failure might.
  if (error instanceof LalamoveApiError) return error.status >= 500
  return true
}

export const lalamoveAdapter: DeliveryProviderAdapter = {
  code: 'lalamove',

  async getQuote(input: QuoteInput, credentials: unknown): Promise<QuoteResult> {
    const cred = credentials as LalamoveCredentials | null
    if (!cred?.api_key || !cred?.api_secret) {
      return { ok: false, error: { code: 'LALAMOVE_NOT_CONNECTED', message: 'No Lalamove account connected', retryable: false } }
    }
    try {
      const quote = await requestQuotation({
        apiKey: cred.api_key,
        apiSecret: cred.api_secret,
        market: countryMarket(cred.market),
        pickup: input.pickup,
        dropoff: input.dropoff,
      })
      if (!quote.quotationId || !quote.priceTotal) {
        return { ok: false, error: { code: 'LALAMOVE_QUOTE_FAILED', message: 'Lalamove returned an incomplete quote', retryable: true } }
      }
      return {
        ok: true,
        externalQuoteId: quote.quotationId,
        fee: Number(quote.priceTotal),
        currency: quote.currency || 'PHP',
        raw: quote.raw,
      }
    } catch (error) {
      return { ok: false, error: { code: 'LALAMOVE_QUOTE_FAILED', message: String((error as Error).message || error), retryable: isRetryable(error) } }
    }
  },

  async createBooking(input: BookingInput, credentials: unknown): Promise<BookingResult> {
    const cred = credentials as LalamoveCredentials | null
    if (!cred?.api_key || !cred?.api_secret) {
      return { ok: false, error: { code: 'LALAMOVE_NOT_CONNECTED', message: 'No Lalamove account connected', retryable: false } }
    }
    try {
      const market = countryMarket(cred.market)
      // Quotes expire quickly on Lalamove's side — always re-quote right
      // before placing the order rather than trusting an earlier one.
      const quote = await requestQuotation({ apiKey: cred.api_key, apiSecret: cred.api_secret, market, pickup: input.pickup, dropoff: input.dropoff })
      if (!quote.quotationId || !quote.pickupStopId || !quote.dropoffStopId) {
        return { ok: false, error: { code: 'LALAMOVE_QUOTE_FAILED', message: 'Lalamove returned an incomplete quote', retryable: true } }
      }
      const placed = await placeOrder({
        apiKey: cred.api_key,
        apiSecret: cred.api_secret,
        market,
        quotationId: quote.quotationId,
        pickupStopId: quote.pickupStopId,
        dropoffStopId: quote.dropoffStopId,
        senderName: input.pickup.name || 'Merchant',
        senderPhone: input.pickup.phone || '',
        recipientName: input.dropoff.name || '',
        recipientPhone: input.dropoff.phone || '',
        orderId: input.orderId,
      })
      if (!placed.lalamoveOrderId) {
        return { ok: false, error: { code: 'LALAMOVE_BOOKING_FAILED', message: 'Lalamove did not return an order id', retryable: true } }
      }
      return {
        ok: true,
        externalOrderId: placed.lalamoveOrderId,
        shareLink: placed.shareLink,
        raw: { quote: quote.raw, order: placed.raw },
      }
    } catch (error) {
      return { ok: false, error: { code: 'LALAMOVE_BOOKING_FAILED', message: String((error as Error).message || error), retryable: isRetryable(error) } }
    }
  },
}
