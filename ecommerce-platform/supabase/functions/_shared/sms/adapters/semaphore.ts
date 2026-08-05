// Semaphore adapter — https://semaphore.co/docs (PH-focused SMS API).
// credentials shape: { api_key: string, sender_name?: string }
//
// VERIFY against a real Semaphore account before enabling in production
// — request/response shape below matches Semaphore's published docs at
// write time but was never exercised against a live call, same caveat
// as the PayMongo and Google Vision adapters.

import type { SmsProviderAdapter, SmsResult } from '../types.ts'

interface SemaphoreCredentials {
  api_key: string
  sender_name?: string
}

const API_URL = 'https://api.semaphore.co/api/v4/messages'

// Semaphore expects PH mobile numbers as 09XXXXXXXXX or 639XXXXXXXXX —
// normalizes +63/whitespace/dashes without guessing at other countries'
// formats, since this integration is scoped to PH numbers only.
function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.startsWith('63')) return digits
  if (digits.startsWith('0')) return `63${digits.slice(1)}`
  return digits
}

function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in data ? String(data[key]) : `{${key}}`))
}

export const semaphoreAdapter: SmsProviderAdapter = {
  code: 'sms.semaphore',

  async send(to: string, template: string, data: Record<string, unknown>, credentials: unknown): Promise<SmsResult> {
    const creds = credentials as SemaphoreCredentials
    if (!creds?.api_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Semaphore API key is not configured', retryable: false } }
    }
    const number = normalizePhoneNumber(to)
    if (!number) {
      return { ok: false, error: { code: 'INVALID_PHONE_NUMBER', message: 'No usable phone number for this recipient', retryable: false } }
    }
    const message = renderTemplate(template, data)
    try {
      const body = new URLSearchParams({ apikey: creds.api_key, number, message })
      if (creds.sender_name) body.set('sendername', creds.sender_name)

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      const responseBody = await res.json()
      if (!res.ok) {
        const errMessage = Array.isArray(responseBody) ? JSON.stringify(responseBody) : responseBody?.message || `Semaphore returned HTTP ${res.status}`
        return { ok: false, raw: responseBody, error: { code: 'SEMAPHORE_API_ERROR', message: errMessage, retryable: res.status >= 500 } }
      }
      const first = Array.isArray(responseBody) ? responseBody[0] : responseBody
      return { ok: true, externalMessageId: first?.message_id != null ? String(first.message_id) : undefined, raw: responseBody }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },
}
