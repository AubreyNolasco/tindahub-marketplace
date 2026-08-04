// SMS Provider Engine — shared contract every SMS adapter implements.
// Mirrors _shared/delivery/types.ts.

export interface SmsResult {
  ok: boolean
  externalMessageId?: string
  raw?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export interface SmsProviderAdapter {
  code: string
  send(to: string, template: string, data: Record<string, unknown>, credentials: unknown): Promise<SmsResult>
}
