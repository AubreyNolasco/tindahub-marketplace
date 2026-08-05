import { supabase } from '../supabase'

// Thin wrapper around the Gemini-backed JomBits upgrade. The keyword
// matcher in config/jomBitsKnowledge.js is always available and is what
// JomBits falls back to the instant this call is disabled, unconfigured,
// or fails for any reason — see JomBits.jsx's ask().

export async function isAiEnabled() {
  const { data, error } = await supabase.rpc('is_integration_enabled', { p_key: 'ai.gemini' })
  if (error) throw error
  return !!data
}

export async function askJomBitsAi(question, role) {
  const { data, error } = await supabase.functions.invoke('jombits-ask', { body: { question, role } })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'JOM Bits AI is unavailable.')
  return data.answer
}
