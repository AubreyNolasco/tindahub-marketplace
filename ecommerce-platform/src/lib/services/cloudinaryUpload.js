import { supabase } from '../supabase'

// Cloudinary product-image upload. ProductForm.jsx's existing Supabase
// Storage upload is untouched and always available as the fallback —
// this only replaces it when isCloudinaryEnabled() resolves true.
//
// The file never passes through our own server: cloudinary-sign-upload
// only returns a signature, then the browser POSTs directly to
// Cloudinary's endpoint with it.

export async function isCloudinaryEnabled() {
  const { data, error } = await supabase.rpc('is_integration_enabled', { p_key: 'storage.cloudinary' })
  if (error) throw error
  return !!data
}

export async function uploadProductImageToCloudinary(file, { folder } = {}) {
  const { data: signed, error: signError } = await supabase.functions.invoke('cloudinary-sign-upload', { body: { folder } })
  if (signError || signed?.error) throw new Error(signed?.error || signError?.message || 'Could not sign the Cloudinary upload.')

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', signed.apiKey)
  form.append('timestamp', String(signed.timestamp))
  form.append('signature', signed.signature)
  form.append('folder', signed.folder)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: 'POST', body: form })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error?.message || 'Cloudinary upload failed.')
  return body.secure_url
}
