// Google Drive adapter — uploads into the *connected admin's own* Drive
// account via a long-lived OAuth refresh token, not a per-end-user
// consent flow. That's deliberate: the ask is one private archive
// ("only I can see it"), not a personal Drive per Reseller/Merchant.
//
// credentials shape (named secrets set via Admin -> Integrations ->
// Google Drive, same convention as every other integration_configs row):
//   { client_id: string, client_secret: string, refresh_token: string, folder_id?: string }
// See GOOGLE_DRIVE_SETUP.md for how to obtain client_id/client_secret/
// refresh_token (OAuth Playground, one-time, drive.file scope only —
// the minimal scope that only ever sees files this app itself creates).
//
// Unlike Cloudinary, there is no client-direct signed-upload equivalent
// for Drive without handing the browser an OAuth access token (which
// would let it act on the connected Drive account itself) — so this
// proxies the file through the edge function instead.
//
// VERIFY against a real Google Cloud OAuth client + Drive account
// before enabling in production — the request/response shapes below
// match Google's published API docs at write time but were never
// exercised against a live call.

import type { StorageProviderAdapter, UploadedFile } from '../types.ts'

interface GoogleDriveCredentials {
  client_id: string
  client_secret: string
  refresh_token: string
  folder_id?: string
}

async function refreshAccessToken(creds: GoogleDriveCredentials): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const body = await res.json()
  if (!res.ok || !body.access_token) {
    throw new Error(body?.error_description || body?.error || `Google token refresh returned HTTP ${res.status}`)
  }
  return body.access_token
}

export const googleDriveAdapter: StorageProviderAdapter = {
  code: 'storage.google_drive',

  async upload(file, options, credentials: unknown): Promise<UploadedFile> {
    const creds = credentials as GoogleDriveCredentials
    if (!creds?.client_id || !creds?.client_secret || !creds?.refresh_token) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Google Drive is not fully configured', retryable: false } }
    }
    try {
      const accessToken = await refreshAccessToken(creds)

      // Drive's "multipart upload" is multipart/related (metadata JSON +
      // raw bytes), a different shape from multipart/form-data — built by
      // hand here since Deno's FormData always produces form-data, not
      // related.
      const boundary = `jomhub-${crypto.randomUUID()}`
      const metadata: Record<string, unknown> = { name: file.filename }
      const folderId = options.folder || creds.folder_id
      if (folderId) metadata.parents = [folderId]

      const encoder = new TextEncoder()
      const head = encoder.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`
      )
      const tail = encoder.encode(`\r\n--${boundary}--`)
      const body = new Uint8Array(head.length + file.bytes.length + tail.length)
      body.set(head, 0)
      body.set(file.bytes, head.length)
      body.set(tail, head.length + file.bytes.length)

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      })
      const responseBody = await res.json()
      if (!res.ok) {
        const message = responseBody?.error?.message || `Google Drive returned HTTP ${res.status}`
        return { ok: false, raw: responseBody, error: { code: 'GOOGLE_DRIVE_API_ERROR', message, retryable: res.status >= 500 } }
      }
      return { ok: true, fileId: responseBody.id, url: responseBody.webViewLink, raw: responseBody }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },
}
