import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/storage/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' }
const MAX_BYTES = 8 * 1024 * 1024

// Reseller/Merchant-invoked from TopupModal.jsx (top-up proof) and
// Admin-invoked from WithdrawalRequests.jsx (transfer proof). Unlike
// Cloudinary, the file is proxied through this function rather than
// uploaded client-direct — Drive uploads need an OAuth access token in
// the request, and that token must never reach the browser (it would
// let the client act on the connected Drive account itself, not just
// upload one file). If Google Drive isn't configured, the caller falls
// back to the existing private Supabase Storage bucket, unchanged.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new Error('MISSING_FILE')
    if (file.size <= 0 || file.size > MAX_BYTES) throw new Error('FILE_TOO_LARGE')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'storage.google_drive' })
    if (!credConfig) throw new Error('NOT_CONFIGURED')

    const bytes = new Uint8Array(await file.arrayBuffer())
    const extension = file.name.split('.').pop() || 'bin'
    const filename = `${user.id}-${Date.now()}.${extension}`

    const result = await getAdapter('storage.google_drive').upload!(
      { bytes, filename, mimeType: file.type || 'application/octet-stream' },
      {},
      credConfig.credentials
    )

    if (!result.ok) {
      await admin.rpc('log_integration_event', {
        p_integration_key: 'storage.google_drive',
        p_direction: 'outbound',
        p_event_type: 'upload_file',
        p_status: 'error',
        p_payload: { owner_id: user.id },
        p_error_message: result.error?.message || 'Unknown error',
      })
      throw new Error(result.error?.code || 'GOOGLE_DRIVE_UNAVAILABLE')
    }

    await admin.rpc('log_integration_event', {
      p_integration_key: 'storage.google_drive',
      p_direction: 'outbound',
      p_event_type: 'upload_file',
      p_status: 'success',
      p_payload: { owner_id: user.id, file_id: result.fileId },
    })

    return new Response(
      JSON.stringify({ fileId: result.fileId, url: result.url }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
