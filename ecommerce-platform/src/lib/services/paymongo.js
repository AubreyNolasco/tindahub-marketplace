import { supabase } from '../supabase'

// Thin wrapper around the PayMongo online top-up path. The manual
// top-up form in TopupModal.jsx is untouched and always available —
// this only adds an optional "Pay online" shortcut that TopupModal
// shows when isPaymongoEnabled() resolves true.

export async function isPaymongoEnabled() {
  const { data, error } = await supabase.rpc('is_integration_enabled', { p_key: 'payments.paymongo' })
  if (error) throw error
  return !!data
}

export async function createPaymongoCheckout(amount) {
  const { data, error } = await supabase.functions.invoke('paymongo-create-intent', { body: { amount } })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not start PayMongo checkout.')
  return data
}
