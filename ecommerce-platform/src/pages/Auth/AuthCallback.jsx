import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const finish = async () => {
      const params = new URLSearchParams(window.location.search)
      const oauthError = params.get('error_description') || params.get('error')
      if (oauthError) {
        if (active) setError(oauthError)
        return
      }
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (!active) return
      if (sessionError) {
        setError(sessionError.message)
        return
      }
      navigate(session ? '/auth/continue' : '/login', { replace: true })
    }
    finish()
    return () => { active = false }
  }, [navigate])
  if (error) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-cream px-4"><div className="w-full max-w-md rounded-3xl border border-coral-200 bg-white p-7 text-center shadow-xl"><h1 className="font-display text-xl font-bold text-ink">Google sign-in failed</h1><p className="mt-2 text-sm leading-6 text-ink/60">{error}</p><button type="button" onClick={() => navigate('/login', { replace: true })} className="btn-primary mt-5 w-full">Return to login</button></div></div>
  return <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 bg-cream"><Spinner /><p className="text-sm font-semibold text-ink/55">Completing secure Google sign-in...</p></div>
}
