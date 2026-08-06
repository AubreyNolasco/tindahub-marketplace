// Storage Provider Engine — shared contract every media adapter
// implements. Mirrors _shared/payments/types.ts and _shared/sms/types.ts.
//
// Two providers, two very different upload mechanics, one shared shape:
// - Cloudinary (storage.cloudinary): the adapter only *signs* an upload
//   (HMAC-SHA1 over the request params, per Cloudinary's documented
//   algorithm) — the actual bytes go straight from the browser to
//   Cloudinary, never through our edge function, so sign() returns a
//   SignedUpload for the client to POST with directly.
// - Google Drive (storage.google_drive): there is no equivalent
//   client-direct signed-upload mechanism, and exposing an OAuth access
//   token to the browser would let it upload to the connected Drive
//   account on its own terms — so upload() proxies the file through the
//   edge function and returns the stored file's reference directly.
//
// Both are optional on the interface since no single provider needs both.

export interface SignedUpload {
  ok: boolean
  cloudName?: string
  apiKey?: string
  timestamp?: number
  signature?: string
  folder?: string
  error?: { code: string; message: string; retryable: boolean }
}

export interface UploadedFile {
  ok: boolean
  fileId?: string
  url?: string
  raw?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export interface StorageProviderAdapter {
  code: string
  sign?(params: { folder?: string }, credentials: unknown): Promise<SignedUpload>
  upload?(file: { bytes: Uint8Array; filename: string; mimeType: string }, options: { folder?: string }, credentials: unknown): Promise<UploadedFile>
}
