// OCR Provider Engine — shared contract every document-OCR adapter
// implements. Mirrors _shared/delivery/types.ts and _shared/sms/types.ts.
// Deliberately read-only/advisory: an adapter extracts text and best-guess
// candidate dates for a human reviewer to check against the image, it
// never approves/rejects anything itself.

export interface OcrResult {
  ok: boolean
  rawText?: string
  candidateDates?: string[] // ISO yyyy-mm-dd, best guess first
  raw?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export interface OcrProviderAdapter {
  code: string
  extractText(imageBase64: string, mimeType: string, credentials: unknown): Promise<OcrResult>
}
