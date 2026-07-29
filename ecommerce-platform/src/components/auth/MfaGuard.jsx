import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Loader2, LogOut, ShieldCheck, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function MfaGuard() {
  const { user, signOutLocal } = useAuth()
  const { pathname } = useLocation()
  const [state, setState] = useState({ status: 'checking' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const inspect = useCallback(async () => {
    if (!user) return setState({ status: 'signed_out' })
    setState({ status: 'checking' })
    const [{ data: aal, error: aalError }, { data: factors, error: factorError }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors()
    ])
    if (aalError || factorError) return setState({ status: 'error', message: aalError?.message || factorError?.message })
    if (aal?.currentLevel === 'aal2') return setState({ status: 'verified' })
    const verified = factors?.totp?.find((factor) => factor.status === 'verified')
    setState(verified ? { status: 'challenge', factorId: verified.id } : { status: 'enroll' })
  }, [user])

  useEffect(() => { inspect() }, [inspect])

  const beginEnrollment = async () => {
    setBusy(true)
    const existing = await supabase.auth.mfa.listFactors()
    for (const factor of existing.data?.totp || []) {
      if (factor.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: factor.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `JOM HUB ${new Date().toLocaleDateString('en-PH')}`
    })
    setBusy(false)
    if (error) return toast.error(error.message)
    setState({ status: 'enrolling', factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return toast.error('Enter the 6-digit authenticator code.')
    setBusy(true)
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: state.factorId })
    if (challengeError) {
      setBusy(false)
      return toast.error(challengeError.message)
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: state.factorId,
      challengeId: challenge.id,
      code
    })
    if (!error) await supabase.auth.refreshSession()
    setBusy(false)
    if (error) return toast.error(/invalid/i.test(error.message) ? 'Invalid authenticator code. Try the newest code.' : error.message)
    setCode('')
    setState({ status: 'verified' })
    toast.success('Two-step verification complete.')
  }

  if (!user || state.status === 'signed_out' || state.status === 'verified' || ['/device-access'].includes(pathname)) return null
  const enrolling = state.status === 'enrolling'
  const challenge = state.status === 'challenge'

  return (
    <div className="fixed inset-0 z-[260] grid place-items-center overflow-y-auto bg-scrim/80 p-4 backdrop-blur-md">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="mfa-title">
        <span className="grid h-13 w-13 place-items-center rounded-2xl bg-teal-50 text-teal-700">
          {state.status === 'checking' ? <Loader2 className="animate-spin" /> : challenge ? <KeyRound /> : <ShieldCheck />}
        </span>
        <h2 id="mfa-title" className="mt-4 font-display text-2xl font-bold">
          {state.status === 'checking' ? 'Checking account security' : challenge ? 'Enter authenticator code' : enrolling ? 'Scan your security QR' : state.status === 'error' ? 'MFA check unavailable' : 'Protect your account'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          {challenge
            ? 'Open your authenticator app and enter its current 6-digit JOM HUB code.'
            : enrolling
              ? 'Scan this QR using Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.'
              : state.status === 'error'
                ? state.message
                : 'JOM HUB requires a free authenticator app before sensitive account actions are allowed.'}
        </p>

        {enrolling && <div className="mt-5 text-center"><img src={state.qrCode} alt="JOM HUB authenticator QR code" className="mx-auto h-48 w-48 rounded-xl border bg-white p-2" /><details className="mt-3 text-left"><summary className="cursor-pointer text-xs font-bold text-teal-700">Cannot scan the QR?</summary><code className="mt-2 block break-all rounded-xl bg-cream p-3 text-xs">{state.secret}</code></details></div>}

        {(enrolling || challenge) && <div className="mt-5"><label className="text-sm font-semibold text-ink/70">6-digit code<input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="input-field mt-2 text-center font-display text-2xl font-bold tracking-[.3em]" placeholder="000000" /></label><button type="button" disabled={busy || code.length !== 6} onClick={verify} className="btn-primary mt-4 flex w-full items-center justify-center gap-2">{busy && <Loader2 size={16} className="animate-spin" />}Verify and continue</button></div>}

        {state.status === 'enroll' && <button type="button" disabled={busy} onClick={beginEnrollment} className="btn-primary mt-6 flex w-full items-center justify-center gap-2"><Smartphone size={17} />Set up free authenticator</button>}
        {state.status === 'error' && <button type="button" onClick={inspect} className="btn-primary mt-6 w-full">Retry security check</button>}
        <button type="button" onClick={signOutLocal} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-xs font-bold text-ink/45"><LogOut size={14} />Sign out</button>
      </section>
    </div>
  )
}
