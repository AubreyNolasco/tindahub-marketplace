import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/sms/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-cron-secret, x-jomhub-device-id' }

// Called only from Postgres triggers via net.http_post (pg_net) — same
// convention as delivery-book/lalamove-book being invoked from
// notify_lalamove_dispatch_ready(). Not reachable by a browser: the
// x-cron-secret header must match SMS_DISPATCH_SECRET, set once via
// `supabase secrets set` and mirrored into the sms_dispatch_secret Vault
// entry the trigger reads from. Deployed with --no-verify-jwt because
// pg_net calls carry no Supabase session JWT.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const expectedSecret = Deno.env.get('SMS_DISPATCH_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')
    if (!expectedSecret || providedSecret !== expectedSecret) throw new Error('UNAUTHORIZED')

    const { to, message, event_type } = await req.json()
    if (typeof to !== 'string' || !to) throw new Error('Invalid request: missing "to"')
    if (typeof message !== 'string' || !message) throw new Error('Invalid request: missing "message"')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'sms.semaphore' })
    if (!credConfig) {
      // Disabled after the trigger fired — acknowledge, do nothing.
      return new Response(JSON.stringify({ ok: true, skipped: 'INTEGRATION_DISABLED' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const result = await getAdapter('sms.semaphore').send(to, message, {}, credConfig.credentials)

    await admin.rpc('log_integration_event', {
      p_integration_key: 'sms.semaphore',
      p_direction: 'outbound',
      p_event_type: event_type || 'send_sms',
      p_status: result.ok ? 'success' : 'error',
      p_payload: { to, event_type },
      p_error_message: result.ok ? null : (result.error?.message || 'Unknown error'),
    })

    if (!result.ok) throw new Error(result.error?.code || 'SMS_SEND_FAILED')

    return new Response(JSON.stringify({ ok: true, message_id: result.externalMessageId }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    const status = error.message === 'UNAUTHORIZED' ? 401 : 400
    return new Response(JSON.stringify({ error: error.message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
