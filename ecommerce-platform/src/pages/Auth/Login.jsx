import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BadgeCheck, KeyRound, Loader2, MailCheck, ShieldCheck, UserRoundCheck, Store, UserRound, Bug } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'
import Spinner from '../../components/ui/Spinner'
import ProfileLoadError from '../../components/auth/ProfileLoadError'
import TurnstileWidget from '../../components/auth/TurnstileWidget'

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const TEST_PASSWORD = 'TestAccount123!'

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.36L15.4 17.1c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.64.39 3.2 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>
}

export default function Login() {
  const { user, profile, profileError, loading, signInWithGoogle, signInWithPassword, requestEmailOtp, verifyEmailOtp, signOut } = useAuth()
  const [redirecting, setRedirecting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [emailCooldown, setEmailCooldown] = useState(0)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [googleBusy, setGoogleBusy] = useState(false)
  const [testAccountsEnabled, setTestAccountsEnabled] = useState(false)
  const [testSigningIn, setTestSigningIn] = useState('')

  useEffect(() => {
    if (emailCooldown <= 0) return
    const timer = window.setTimeout(() => setEmailCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [emailCooldown])

  useEffect(() => {
    supabase.rpc('get_test_accounts_status').then(({ data, error }) => {
      if (!error && data?.enabled) setTestAccountsEnabled(true)
    }).catch(() => {})
    const params = new URLSearchParams(window.location.search)
    const tester = params.get('tester')
    if (tester === 'merchant' || tester === 'reseller') {
      const email = tester === 'merchant' ? 'merchant@gmail.com' : 'reseller@gmail.com'
      const timer = setTimeout(() => {
        supabase.rpc('get_test_accounts_status').then(({ data }) => {
          if (data?.enabled) signInTest(email)
        }).catch(() => {})
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  if (loading) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-cream"><Spinner /></div>
  if (user && !profile) return profileError ? <ProfileLoadError message={profileError} onSignOut={signOut} /> : <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-cream"><Spinner /></div>
  if (user) return <Navigate to={profile.onboarding_completed === false ? '/onboarding' : '/auth/continue'} replace />

  const signInTest = async (email) => {
    setTestSigningIn(email)
    const { error } = await signInWithPassword(email, TEST_PASSWORD)
    if (error) {
      toast.error('Test account sign-in failed: ' + (error.message || 'Unknown error'))
      setTestSigningIn('')
    }
  }

  const submitEmailLogin = async (event) => {
    event.preventDefault()
    if (!navigator.onLine) return toast.error('You are offline. Connect to the internet before requesting a verification code.')
    if (turnstileSiteKey && !captchaToken) return toast.error('Complete the security check first.')
    setRedirecting(true)
    try {
      const result = await requestEmailOtp(testEmail, captchaToken)
      if (result.error) {
        const message = result.error.message || ''
        if (/failed to fetch|network|load failed/i.test(message)) toast.error('Cannot reach Supabase from this browser. Disable VPN/ad blocker, check your connection, then try again.')
        else if (/rate limit/i.test(message)) toast.error('Too many email requests. Please wait a few minutes before trying again.')
        else if (/security purposes|request this after/i.test(message)) toast.error('Please wait before requesting another verification code.')
        else if (/email.*disabled|signups.*disabled/i.test(message)) toast.error('Email sign-in is not enabled in Supabase Authentication settings.')
        else toast.error(message)
      } else {
        setOtpSent(true)
        setEmailCooldown(60)
        toast.success('We sent a 6-digit verification code to your email.')
      }
    } catch (error) {
      console.error('Email authentication request failed:', error)
      toast.error('Cannot reach Supabase from this browser. Disable VPN/ad blocker, check your connection, then try again.')
    } finally { setRedirecting(false) }
  }

  const startGoogleSignIn = async () => {
    setGoogleBusy(true)
    const { error } = await signInWithGoogle()
    if (error) { setGoogleBusy(false); toast.error(error.message) }
  }

  const submitOtp = async (event) => {
    event.preventDefault()
    if (otp.length !== 6) return toast.error('Enter the complete 6-digit code.')
    setRedirecting(true)
    const { error } = await verifyEmailOtp(testEmail, otp)
    setRedirecting(false)
    if (error) return toast.error(/expired|invalid/i.test(error.message) ? 'Invalid or expired code. Request a new code and try again.' : error.message)
    toast.success('Email verified. Signing you in...')
  }

  const loginSteps = [
    { icon: MailCheck, title: 'Enter your email', text: 'Use an email address you can open now.' },
    { icon: KeyRound, title: 'Verify the 6-digit code', text: 'Check your inbox and enter the code within 10 minutes.' },
    { icon: UserRoundCheck, title: 'Follow your next step', text: 'New users choose a role; returning users continue to their workspace.' }
  ]

  const testCard = testAccountsEnabled ? <div className="rounded-3xl border border-mango-300 bg-gradient-to-br from-mango-100 to-mango-50 p-5 shadow-xl shadow-mango-900/[0.06] sm:p-6"><div className="mb-3 flex items-center gap-2"><Bug size={18} className="text-mango-700" /><span className="text-xs font-bold uppercase tracking-[0.14em] text-mango-700">Test Accounts (Dev Only)</span></div><div className="grid gap-3 sm:grid-cols-2"><button onClick={() => signInTest('merchant@gmail.com')} disabled={testSigningIn === 'merchant@gmail.com'} className="group flex items-center gap-3 rounded-xl border-2 border-teal-200 bg-white p-4 text-left transition hover:border-teal-600 hover:shadow-md disabled:opacity-50"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700"><Store size={20} /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink">Merchant Test</p><p className="truncate text-xs text-ink/50">merchant@gmail.com</p></div>{testSigningIn === 'merchant@gmail.com' && <Loader2 size={16} className="animate-spin text-teal-600" />}</button><button onClick={() => signInTest('reseller@gmail.com')} disabled={testSigningIn === 'reseller@gmail.com'} className="group flex items-center gap-3 rounded-xl border-2 border-mango-200 bg-white p-4 text-left transition hover:border-mango-600 hover:shadow-md disabled:opacity-50"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-mango-100 text-mango-700"><UserRound size={20} /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink">Reseller Test</p><p className="truncate text-xs text-ink/50">reseller@gmail.com</p></div>{testSigningIn === 'reseller@gmail.com' && <Loader2 size={16} className="animate-spin text-mango-600" />}</button></div><p className="mt-2 text-[11px] text-ink/45">Auto-approved with ₱10M wallet. Disable in Admin Panel for production.</p></div> : null

  return <AuthShell><div className="space-y-4"><div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-xl shadow-teal-900/[0.06] sm:p-8"><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700"><ShieldCheck size={14} /> Secure email OTP</span><h1 className="mt-4 font-display text-3xl font-bold text-ink">Continue to JOM HUB</h1><p className="mt-2 text-sm leading-6 text-ink/55">{otpSent ? `Enter the 6-digit code sent to ${testEmail}.` : 'Enter your email and we will send a secure 6-digit verification code.'}</p>{otpSent ? <form onSubmit={submitOtp} className="mt-7 space-y-3"><input inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="input-field text-center font-display text-2xl font-bold tracking-[0.35em]" /><button disabled={redirecting || otp.length !== 6} className="btn-primary flex w-full items-center justify-center gap-2">{redirecting && <Loader2 size={18} className="animate-spin" />}Verify code</button><button type="button" disabled={redirecting || emailCooldown > 0} onClick={submitEmailLogin} className="btn-secondary w-full">{emailCooldown > 0 ? `Send again in ${emailCooldown}s` : 'Resend code'}</button><button type="button" onClick={() => { setOtpSent(false); setOtp('') }} className="w-full py-2 text-xs font-bold text-teal-700">Use a different email</button></form> : <form onSubmit={submitEmailLogin} className="mt-7 space-y-3"><input type="email" required value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="Email address" className="input-field" autoComplete="username" />{turnstileSiteKey ? <TurnstileWidget siteKey={turnstileSiteKey} onToken={setCaptchaToken} /> : null}<button disabled={redirecting} className="btn-primary flex w-full items-center justify-center gap-2">{redirecting ? <Loader2 size={18} className="animate-spin" /> : <MailCheck size={18} />}Send verification code</button></form>}{!otpSent ? <><div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/35"><span className="h-px flex-1 bg-black/[0.06]" />or<span className="h-px flex-1 bg-black/[0.06]" /></div><button type="button" onClick={startGoogleSignIn} disabled={googleBusy} className="btn-secondary flex w-full items-center justify-center gap-2 disabled:opacity-50">{googleBusy ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}Continue with Google</button></> : null}<div className="mt-6 rounded-2xl bg-cream p-4 text-xs leading-5 text-ink/50"><p className="font-semibold text-ink/70">Secure one-time code</p><p className="mt-1">The code expires in 10 minutes and can only be used once. Never share it with anyone.</p></div></div>{testCard}<section className="rounded-3xl border border-teal-100 bg-white p-5 shadow-card" aria-labelledby="login-guide-title"><div className="flex items-center gap-2"><BadgeCheck size={18} className="text-teal-600" /><h2 id="login-guide-title" className="font-display font-bold text-ink">How to sign in</h2></div><ol className="mt-4 space-y-3">{loginSteps.map(({ icon: Icon, title, text }, index) => <li key={title} className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={17} /></span><div><p className="text-sm font-bold text-ink"><span className="mr-1 text-teal-600">{index + 1}.</span>{title}</p><p className="mt-0.5 text-xs leading-5 text-ink/50">{text}</p></div></li>)}</ol></section></div></AuthShell>
}
