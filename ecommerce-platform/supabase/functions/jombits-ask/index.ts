import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/ai/registry.ts'
import { getKnowledgeScope } from '../_shared/ai/knowledge.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' }

// Signed-in-user-invoked from JomBits.jsx when ai.gemini is enabled.
// Deliberately stateless and narrow: only ever sees the typed question,
// the caller's role, and the fixed JOM HUB knowledge text — never wallet
// balance, orders, or any other account data, so there's nothing
// sensitive to leak to Gemini even though the key itself isn't secret
// in the browser sense (it's called from here, server-side, same as
// every other Vault-backed integration). If disabled, unconfigured, or
// the call fails, the frontend falls back to the existing keyword
// matcher — this function returning an error is an expected, handled
// path, not a bug.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { question, role } = await req.json()
    if (typeof question !== 'string' || !question.trim()) throw new Error('Invalid request: missing "question"')
    const safeRole = role === 'merchant' ? 'merchant' : 'reseller'
    const safeQuestion = question.trim().slice(0, 500)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'ai.gemini' })
    if (!credConfig) throw new Error('NOT_CONFIGURED')

    const result = await getAdapter('ai.gemini').answer(safeQuestion, { role: safeRole, knowledgeScope: getKnowledgeScope(safeRole) }, credConfig.credentials)

    await admin.rpc('log_integration_event', {
      p_integration_key: 'ai.gemini',
      p_direction: 'outbound',
      p_event_type: 'jombits_answer',
      p_status: result.ok ? 'success' : 'error',
      p_payload: { owner_id: user.id, role: safeRole },
      p_error_message: result.ok ? null : (result.error?.message || 'Unknown error'),
    })

    if (!result.ok) throw new Error(result.error?.code || 'AI_UNAVAILABLE')

    return new Response(JSON.stringify({ answer: result.answer }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
