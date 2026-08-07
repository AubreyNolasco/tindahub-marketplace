import { supabase } from '../supabase'

// Thin wrapper around the PayPal online top-up path — mirrors paymongo.js
// exactly. The manual top-up form in TopupModal.jsx is untouched; this
// only adds an optional "Pay with PayPal" shortcut shown when
// isPaypalEnabled() resolves true.

export async function isPaypalEnabled() {
  const { data, error } = await supabase.rpc('is_integration_enabled', { p_key: 'payments.paypal' })
  if (error) throw error
  return !!data
}

export async function createPaypalCheckout(amount) {
  const { data, error } = await supabase.functions.invoke('paypal-create-intent', { body: { amount } })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not start PayPal checkout.')
  return data
}
