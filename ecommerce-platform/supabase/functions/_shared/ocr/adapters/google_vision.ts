// Google Vision adapter — images:annotate (DOCUMENT_TEXT_DETECTION).
// credentials shape: { api_key: string }
//
// VERIFY against a real Google Vision API key before enabling in
// production — request/response shape below matches Google's published
// REST docs at write time but was never exercised against a live call,
// same caveat as lalamove-webhook/index.ts and the PayMongo adapter.

import type { OcrProviderAdapter, OcrResult } from '../types.ts'

interface GoogleVisionCredentials {
  api_key: string
}

const API_URL = 'https://vision.googleapis.com/v1/images:annotate'

// Deliberately conservative: only formats that are unambiguous without
// knowing the document's country conventions (dd/mm vs mm/dd is a coin
// flip and a wrong guess is worse than no guess). Month-name formats and
// yyyy-first numeric formats are unambiguous either way.
const MONTHS: Record<string, string> = {
  january: '01', jan: '01', february: '02', feb: '02', march: '03', mar: '03',
  april: '04', apr: '04', may: '05', june: '06', jun: '06', july: '07', jul: '07',
  august: '08', aug: '08', september: '09', sep: '09', sept: '09', october: '10', oct: '10',
  november: '11', nov: '11', december: '12', dec: '12',
}

function extractCandidateDates(text: string): string[] {
  const found = new Set<string>()

  // "March 1, 2027" / "Mar 1 2027" / "1 March 2027"
  const monthNamePattern = /\b(?:([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4}))\b/g
  for (const m of text.matchAll(monthNamePattern)) {
    const monthWord = (m[1] || m[5] || '').toLowerCase()
    const day = m[2] || m[4]
    const year = m[3] || m[6]
    const month = MONTHS[monthWord]
    if (month && day && year) {
      found.add(`${year}-${month}-${day.padStart(2, '0')}`)
    }
  }

  // yyyy-mm-dd or yyyy/mm/dd — unambiguous, year always leads
  const isoPattern = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g
  for (const m of text.matchAll(isoPattern)) {
    const [, year, month, day] = m
    if (Number(month) <= 12 && Number(day) <= 31) {
      found.add(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
    }
  }

  return Array.from(found)
}

export const googleVisionAdapter: OcrProviderAdapter = {
  code: 'ocr.google_vision',

  async extractText(imageBase64: string, mimeType: string, credentials: unknown): Promise<OcrResult> {
    const creds = credentials as GoogleVisionCredentials
    if (!creds?.api_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Google Vision API key is not configured', retryable: false } }
    }
    try {
      const res = await fetch(`${API_URL}?key=${encodeURIComponent(creds.api_key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            },
          ],
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.error?.message || `Google Vision returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'VISION_API_ERROR', message, retryable: res.status >= 500 } }
      }
      const result = body?.responses?.[0]
      if (result?.error) {
        return { ok: false, raw: body, error: { code: 'VISION_ANNOTATION_ERROR', message: result.error.message || 'Unknown Vision error', retryable: false } }
      }
      const rawText: string = result?.fullTextAnnotation?.text || ''
      return { ok: true, rawText, candidateDates: extractCandidateDates(rawText), raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },
}
