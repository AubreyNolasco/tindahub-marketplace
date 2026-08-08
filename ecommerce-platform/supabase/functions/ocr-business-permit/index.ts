import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdapter } from '../_shared/ocr/registry.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-jomhub-device-id' }

function guessMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'pdf') return 'application/pdf'
  return 'image/jpeg'
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// Admin-invoked "Read with AI" button in Admin/Merchants.jsx. On-demand
// only (not run automatically on every merchant upload) so nothing is
// spent OCR-ing permits nobody is currently reviewing. Purely advisory —
// see the migration header for why this never touches business_permit_status.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    // Same permission scope Admin/Merchants.jsx itself requires (admin, or
    // staff granted the "merchants" module) — see has_admin_permission()
    // from 20260805000100_fix_staff_access.sql.
    const { data: allowed } = await userClient.rpc('has_admin_permission', { p_permission: 'merchants' })
    if (!allowed) throw new Error('FORBIDDEN')

    const { merchant_id } = await req.json()
    if (typeof merchant_id !== 'string' || !merchant_id) throw new Error('Invalid request')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: merchant, error: merchantError } = await admin
      .from('merchant_profiles')
      .select('business_permit_url')
      .eq('id', merchant_id)
      .single()
    if (merchantError || !merchant) throw new Error('Merchant not found')
    if (!merchant.business_permit_url) throw new Error('NO_PERMIT_ATTACHED')

    const { data: credConfig } = await admin.rpc('get_integration_credentials', { p_key: 'ocr.google_vision' })
    if (!credConfig) throw new Error('NOT_CONFIGURED')

    const { data: fileBlob, error: downloadError } = await admin.storage.from('business-permits').download(merchant.business_permit_url)
    if (downloadError || !fileBlob) throw new Error('Could not load the permit file')

    const base64 = arrayBufferToBase64(await fileBlob.arrayBuffer())
    const mimeType = guessMimeType(merchant.business_permit_url)

    const result = await getAdapter('ocr.google_vision').extractText(base64, mimeType, credConfig.credentials)

    if (!result.ok) {
      await admin.rpc('log_integration_event', {
        p_integration_key: 'ocr.google_vision',
        p_direction: 'outbound',
        p_event_type: 'extract_text',
        p_status: 'error',
        p_payload: { merchant_id },
        p_error_message: result.error?.message || 'Unknown error',
      })
      throw new Error(result.error?.code || 'OCR_FAILED')
    }

    await admin.from('document_ocr_results').insert({
      subject_type: 'merchant_business_permit',
      subject_id: merchant_id,
      provider_key: 'ocr.google_vision',
      raw_text: result.rawText || '',
      candidate_dates: result.candidateDates || [],
    })

    await admin.rpc('log_integration_event', {
      p_integration_key: 'ocr.google_vision',
      p_direction: 'outbound',
      p_event_type: 'extract_text',
      p_status: 'success',
      p_payload: { merchant_id, candidate_dates: result.candidateDates || [] },
    })

    return new Response(
      JSON.stringify({ raw_text: result.rawText || '', candidate_dates: result.candidateDates || [] }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
