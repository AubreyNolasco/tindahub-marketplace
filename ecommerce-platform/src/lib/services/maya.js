import { supabase } from '../supabase'

// Thin wrapper around the Maya online top-up path — mirrors paymongo.js
// exactly. The manual top-up form in TopupModal.jsx is untouched; this
// only adds an optional "Pay with Maya" shortcut shown when
// isMayaEnabled() resolves true.

export async function isMayaEnabled() {
  const { data, error } = await supabase.rpc('is_integration_enabled', { p_key: 'payments.maya' })
  if (error) throw error
  return !!data
}

export async function createMayaCheckout(amount) {
  const { data, error } = await supabase.functions.invoke('maya-create-intent', { body: { amount } })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not start Maya checkout.')
  return data
}
