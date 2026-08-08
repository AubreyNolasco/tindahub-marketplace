import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/payments/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-jomhub-device-id' }

// Reseller/Merchant-invoked from TopupModal.jsx's "Pay with Stripe" option.
// Mirrors paymongo-create-intent/index.ts's shape exactly.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { amount } = await req.json()
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('INVALID_AMOUNT')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'payments.stripe' })
    if (!credConfig) throw new Error('NOT_CONFIGURED')

    const reference = crypto.randomUUID()
    const intent = await getAdapter('payments.stripe').createIntent(
      { orderId: reference, amount: numericAmount, currency: 'PHP' },
      credConfig.credentials
    )

    if (!intent.ok) {
      await admin.rpc('log_integration_event', {
        p_integration_key: 'payments.stripe',
        p_direction: 'outbound',
        p_event_type: 'create_checkout_session',
        p_status: 'error',
        p_payload: { owner_id: user.id, amount: numericAmount, reference },
        p_error_message: intent.error?.message || 'Unknown error',
      })
      throw new Error(intent.error?.code || 'STRIPE_UNAVAILABLE')
    }

    const { data: topup, error: topupError } = await admin
      .from('topup_requests')
      .insert({ owner_id: user.id, amount: numericAmount, method: 'stripe', reference_number: intent.externalRef, status: 'pending' })
      .select('id')
      .single()
    if (topupError || !topup) throw topupError || new Error('TOPUP_INSERT_FAILED')

    await admin.from('payment_intents').insert({
      topup_request_id: topup.id,
      provider_key: 'payments.stripe',
      external_ref: intent.externalRef,
      status: 'pending',
      checkout_url: intent.redirectUrl,
      raw_payload: intent.raw ?? {},
    })

    await admin.rpc('log_integration_event', {
      p_integration_key: 'payments.stripe',
      p_direction: 'outbound',
      p_event_type: 'create_checkout_session',
      p_status: 'success',
      p_payload: { owner_id: user.id, topup_request_id: topup.id, external_ref: intent.externalRef },
    })

    return new Response(JSON.stringify({ checkout_url: intent.redirectUrl, topup_request_id: topup.id }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
