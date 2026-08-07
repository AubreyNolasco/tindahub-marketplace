import { supabase } from '../supabase'

// Thin wrapper around the Stripe online top-up path — mirrors paymongo.js
// exactly. The manual top-up form in TopupModal.jsx is untouched; this
// only adds an optional "Pay with Stripe" shortcut shown when
// isStripeEnabled() resolves true.

export async function isStripeEnabled() {
  const { data, error } = await supabase.rpc('is_integration_enabled', { p_key: 'payments.stripe' })
  if (error) throw error
  return !!data
}

export async function createStripeCheckout(amount) {
  const { data, error } = await supabase.functions.invoke('stripe-create-intent', { body: { amount } })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not start Stripe checkout.')
  return data
}
