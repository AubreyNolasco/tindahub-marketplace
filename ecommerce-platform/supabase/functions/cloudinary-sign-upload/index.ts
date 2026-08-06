import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/storage/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' }

// Merchant/Admin-invoked from ProductForm.jsx before uploading a product
// image. Returns only what the browser needs to POST the file straight
// to Cloudinary's own endpoint — the api_secret used to produce the
// signature never leaves this function. If Cloudinary isn't configured,
// the caller falls back to the existing Supabase Storage upload,
// unchanged.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { folder } = await req.json().catch(() => ({}))

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'storage.cloudinary' })
    if (!credConfig) throw new Error('NOT_CONFIGURED')

    const signed = await getAdapter('storage.cloudinary').sign!({ folder }, credConfig.credentials)
    if (!signed.ok) {
      await admin.rpc('log_integration_event', {
        p_integration_key: 'storage.cloudinary',
        p_direction: 'outbound',
        p_event_type: 'sign_upload',
        p_status: 'error',
        p_payload: { owner_id: user.id },
        p_error_message: signed.error?.message || 'Unknown error',
      })
      throw new Error(signed.error?.code || 'CLOUDINARY_UNAVAILABLE')
    }

    return new Response(
      JSON.stringify({ cloudName: signed.cloudName, apiKey: signed.apiKey, timestamp: signed.timestamp, signature: signed.signature, folder: signed.folder }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
