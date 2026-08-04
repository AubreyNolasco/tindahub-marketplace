import { supabase } from '../supabase'

// Thin wrapper around the Google Vision "Read with AI" button in
// Admin/Merchants.jsx. Purely advisory — see the OCR migration header
// for why this never changes business_permit_status itself.

export async function isOcrEnabled() {
  const { data, error } = await supabase.rpc('is_integration_enabled', { p_key: 'ocr.google_vision' })
  if (error) throw error
  return !!data
}

export async function readBusinessPermit(merchantId) {
  const { data, error } = await supabase.functions.invoke('ocr-business-permit', { body: { merchant_id: merchantId } })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not read the permit with AI.')
  return data
}
