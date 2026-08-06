import { supabase } from '../supabase'

// Payment-proof upload to the connected admin's own private Google
// Drive. TopupModal.jsx's and WithdrawalRequests.jsx's existing
// Supabase Storage upload is untouched and always available as the
// fallback — this only replaces it when isGoogleDriveEnabled() resolves
// true. Returns a Drive webViewLink, which only the connected Drive
// account can actually open — that's the point (private archive, not a
// public/shareable link).

export async function isGoogleDriveEnabled() {
  const { data, error } = await supabase.rpc('is_integration_enabled', { p_key: 'storage.google_drive' })
  if (error) throw error
  return !!data
}

export async function uploadPaymentProofToGoogleDrive(file) {
  const form = new FormData()
  form.append('file', file)
  const { data, error } = await supabase.functions.invoke('google-drive-upload', { body: form })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not upload the proof to Google Drive.')
  return data.url
}
