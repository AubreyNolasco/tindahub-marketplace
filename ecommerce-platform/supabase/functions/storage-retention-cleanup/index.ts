import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret' }

// Scheduled weekly by pg_cron (see 20260728000300_storage_and_log_retention.sql
// for the read-only orphan-detection query this relies on). Only ever invoked
// by the cron job itself via the shared secret below — never by end users.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const secret = req.headers.get('x-cron-secret') || ''
    if (!secret || secret !== Deno.env.get('CRON_SECRET')) throw new Error('Unauthorized')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: orphans, error } = await admin.rpc('list_storage_orphans', { p_grace_period: '7 days' })
    if (error) throw error

    const byBucket = new Map()
    for (const row of orphans || []) {
      if (!byBucket.has(row.bucket_id)) byBucket.set(row.bucket_id, [])
      byBucket.get(row.bucket_id).push(row.object_name)
    }

    const summary = {}
    for (const [bucket, paths] of byBucket) {
      const { data: removed, error: removeError } = await admin.storage.from(bucket).remove(paths)
      summary[bucket] = { attempted: paths.length, removed: removeError ? 0 : (removed?.length || 0), error: removeError?.message || null }
    }

    return new Response(JSON.stringify({ ok: true, summary }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
