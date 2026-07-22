import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, MailCheck, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'
import Spinner from '../../components/ui/Spinner'

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.36L15.4 17.1c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.64.39 3.2 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>
}

export default function Login() {
  const { user, profile, loading, signInTestAccount, requestEmailSignInLink } = useAuth()
  const [redirecting, setRedirecting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testPassword, setTestPassword] = useState('')
  const [emailCooldown, setEmailCooldown] = useState(0)

  useEffect(() => {
    if (emailCooldown <= 0) return undefined
    const timer = window.setTimeout(() => setEmailCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [emailCooldown])
  if (loading) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-cream"><Spinner /></div>
  if (user) return <Navigate to={profile?.onboarding_completed === false ? '/onboarding' : '/auth/continue'} replace />

  const submitEmailLogin = async (event) => {
    event.preventDefault()
    if (!navigator.onLine) return toast.error('You are offline. Connect to the internet before requesting a sign-in link.')
    setRedirecting(true)
    try {
      const normalizedEmail = testEmail.trim().toLowerCase()
      const isTest = ['reseller@gmail.com', 'merchant@gmail.com'].includes(normalizedEmail)
      const result = isTest
        ? await signInTestAccount(normalizedEmail, testPassword)
        : await requestEmailSignInLink(normalizedEmail)
      if (result.error) {
        const message = result.error.message || ''
        if (/failed to fetch|network|load failed/i.test(message)) toast.error('Cannot reach Supabase from this browser. Disable VPN/ad blocker, check your connection, then try again.')
        else if (/rate limit/i.test(message)) toast.error('Too many email requests. Please wait a few minutes before trying again.')
        else if (/security purposes|request this after/i.test(message)) toast.error('Please wait a few seconds before requesting another sign-in link.')
        else if (/email.*disabled|signups.*disabled/i.test(message)) toast.error('Email sign-in is not enabled in Supabase Authentication settings.')
        else toast.error(message)
      } else if (!isTest) {
        setEmailCooldown(10)
        toast.success('We sent a secure sign-in link to your email.')
      }
    } catch (error) {
      console.error('Email authentication request failed:', error)
      toast.error('Cannot reach Supabase from this browser. Disable VPN/ad blocker, check your connection, then try again.')
    } finally {
      setRedirecting(false)
    }
  }

  const normalizedEmail = testEmail.trim().toLowerCase()
  const isTest = ['reseller@gmail.com', 'merchant@gmail.com'].includes(normalizedEmail)
  return <AuthShell><div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-xl shadow-teal-900/[0.06] sm:p-8"><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700"><ShieldCheck size={14} /> Secure email access</span><h1 className="mt-4 font-display text-3xl font-bold text-ink">Continue to JOM HUB</h1><p className="mt-2 text-sm leading-6 text-ink/55">Enter your email. We will send you a secure one-time sign-in link.</p><form onSubmit={submitEmailLogin} className="mt-7 space-y-3"><input type="email" required value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="Email address" className="input-field" autoComplete="username" />{isTest ? <input type="password" required value={testPassword} onChange={(event) => setTestPassword(event.target.value)} placeholder="Password" className="input-field" autoComplete="current-password" /> : null}<button disabled={redirecting || (!isTest && emailCooldown > 0)} className="btn-primary flex w-full items-center justify-center gap-2">{redirecting ? <Loader2 size={18} className="animate-spin" /> : <MailCheck size={18} />}{isTest ? 'Sign in' : emailCooldown > 0 ? `Send again in ${emailCooldown}s` : 'Send sign-in link'}</button></form><div className="mt-6 rounded-2xl bg-cream p-4 text-xs leading-5 text-ink/50"><p className="font-semibold text-ink/70">Secure email sign-in</p><p className="mt-1">The link expires shortly and can only be used once.</p></div></div></AuthShell>
}
