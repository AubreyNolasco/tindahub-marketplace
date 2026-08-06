// Cloudinary adapter — signed upload (https://cloudinary.com/documentation/upload_images#generating_authentication_signatures).
// credentials shape (named secrets set via Admin -> Integrations ->
// Cloudinary, same convention as every other integration_configs row):
//   { cloud_name: string, api_key: string, api_secret: string }
//
// This adapter never uploads bytes itself — it only signs the request.
// The browser then POSTs the file straight to Cloudinary's own endpoint
// with that signature, so the (compressed, already-small) image never
// passes through our edge function at all. The api_secret used to
// produce the signature never leaves this function.
//
// VERIFY against a real Cloudinary account before enabling in
// production — the signing algorithm below matches Cloudinary's
// published docs at write time but was never exercised against a live
// upload.

import type { StorageProviderAdapter, SignedUpload } from '../types.ts'

interface CloudinaryCredentials {
  cloud_name: string
  api_key: string
  api_secret: string
}

async function sha1Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(message))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const cloudinaryAdapter: StorageProviderAdapter = {
  code: 'storage.cloudinary',

  // Only `folder` and `timestamp` are signed here — the minimum needed
  // for a product-image upload. Any other param the client adds to the
  // actual upload request (that isn't one of Cloudinary's always-unsigned
  // fields: file, cloud_name, resource_type, api_key) would need adding
  // to both this signed string AND the client's FormData, in the same
  // alphabetical order, or Cloudinary will reject the signature.
  async sign(params: { folder?: string }, credentials: unknown): Promise<SignedUpload> {
    const creds = credentials as CloudinaryCredentials
    if (!creds?.cloud_name || !creds?.api_key || !creds?.api_secret) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Cloudinary is not fully configured', retryable: false } }
    }
    const timestamp = Math.floor(Date.now() / 1000)
    const folder = params.folder || 'jomhub/products'
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${creds.api_secret}`
    const signature = await sha1Hex(stringToSign)
    return {
      ok: true,
      cloudName: creds.cloud_name,
      apiKey: creds.api_key,
      timestamp,
      signature,
      folder,
    }
  },
}
