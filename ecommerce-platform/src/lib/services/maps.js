import { supabase } from '../supabase'

// Same on/off convention as isPaymongoEnabled()/isOcrEnabled() — admin
// flips maps.locationiq on in Settings -> Integrations once a real
// VITE_LOCATIONIQ_API_KEY is deployed. AddressFields falls back to the
// plain structured inputs (no autocomplete box) whenever this is false.

export async function isMapsEnabled() {
  const { data, error } = await supabase.rpc('is_integration_enabled', { p_key: 'maps.locationiq' })
  if (error) throw error
  return !!data
}
