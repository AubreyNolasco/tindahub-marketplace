import { supabase } from '../supabase'

// Thin wrapper around integration_configs / integration_event_logs.
// Convention for new integration UI going forward — existing pages keep
// calling supabase.from()/.rpc() directly, this isn't a retrofit.

export async function listIntegrations() {
  const { data, error } = await supabase.rpc('get_integration_configs')
  if (error) throw error
  return data || []
}

export async function saveIntegration(key, { enabled, mode, credentials, webhookSecret }) {
  const { data, error } = await supabase.rpc('save_integration_config', {
    p_key: key,
    p_enabled: enabled,
    p_mode: mode,
    p_credentials: credentials && Object.keys(credentials).length ? credentials : null,
    p_webhook_secret: webhookSecret || null,
  })
  if (error) throw error
  return data
}

export async function listIntegrationLogs(key, limit = 50) {
  const { data, error } = await supabase
    .from('integration_event_logs')
    .select('*')
    .eq('integration_key', key)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
