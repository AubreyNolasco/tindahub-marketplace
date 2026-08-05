import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user?.email) throw new Error('Unauthorized')
    const { token, deviceLabel } = await req.json()
    if (!/^[a-f0-9]{64}$/.test(token || '') || typeof deviceLabel !== 'string' || deviceLabel.trim().length < 3) throw new Error('Invalid request')
    const { data: validToken, error: tokenError } = await client.rpc('validate_my_device_email_token', { p_token: token })
    if (tokenError || !validToken) throw new Error('Invalid or expired device request')
    const base = 'https://tindahub-marketplace.vercel.app/device-access'
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: Deno.env.get('JOMHUB_GMAIL_USER'), pass: Deno.env.get('JOMHUB_GMAIL_APP_PASSWORD') }
    })
    await transport.sendMail({
      from: `"JOM HUB Security" <${Deno.env.get('JOMHUB_GMAIL_USER')}>`,
      to: user.email,
      subject: 'New gadget wants to access your JOM HUB account',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#16211e"><h2>New gadget sign-in request</h2><p><b>${String(deviceLabel).replace(/[<>&"]/g,'')}</b> wants to use your account.</p><p>Review an action within 20 minutes:</p><p><a href="${base}?action=approve&token=${token}" style="display:inline-block;background:#16794b;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Review logout request</a></p><p><a href="${base}?action=block&token=${token}" style="display:inline-block;background:#e4572e;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Review block request</a></p><p style="font-size:12px;color:#667">The link opens a confirmation page and does not act automatically. Never share email codes or passwords.</p></div>`
    })
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
