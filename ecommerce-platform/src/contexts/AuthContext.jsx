import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const TEST_EMAILS = new Set(['reseller@gmail.com', 'merchant@gmail.com'])

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId, userEmail = '', provider = '') => {
    setProfileError(null)
    if (!userId) {
      setProfile(null)
      return
    }
    if (provider === 'google') {
      const { error: syncError } = await supabase.rpc('sync_google_profile')
      if (syncError) {
        console.error('Unable to sync Google profile:', syncError.message)
        setProfile(null)
        setProfileError(syncError.message)
        return
      }
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('Failed to load profile:', error.message)
      setProfile(null)
      setProfileError(error.message)
    } else if (!data) {
      setProfile(null)
      setProfileError('No profile record was found for this account. Apply the Google OAuth database migration, then sign in again.')
    } else {
      if (data?.role === 'staff') {
        const { data: staffAccess, error: staffError } = await supabase.from('staff_access').select('permissions, active').eq('user_id', userId).maybeSingle()
        if (staffError) console.error('Failed to load staff permissions:', staffError.message)
        setProfile({ ...data, staff_access: staffAccess || { permissions: [], active: false } })
        return
      }
      if (data?.role === 'merchant') {
        const { data: merchantProfile, error: merchantError } = await supabase.rpc('get_my_merchant_profile')
        if (merchantError) console.error('Failed to load merchant profile:', merchantError.message)
        setProfile({ ...data, merchant_profiles: merchantProfile || null })
      } else {
        setProfile(data)
      }
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) setProfileError(error.message)
      setSession(session)
      if (session?.user) await loadProfile(session.user.id, session.user.email, session.user.app_metadata?.provider)
    }).catch((error) => {
      console.error('Failed to initialize authentication:', error)
      setProfileError(error.message || 'Unable to initialize authentication.')
    }).finally(() => setLoading(false))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        setTimeout(() => loadProfile(session.user.id, session.user.email, session.user.app_metadata?.provider), 0)
      } else {
        setProfile(null)
        setProfileError(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadProfile])

  const signInWithGoogle = async () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'openid email profile',
      queryParams: { prompt: 'select_account' }
    }
  })

  const signInTestAccount = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!TEST_EMAILS.has(normalizedEmail)) return { error: new Error('This login is only for the two registered test accounts.') }
    return supabase.auth.signInWithPassword({ email: normalizedEmail, password })
  }

  const requestEmailOtp = async (email) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (TEST_EMAILS.has(normalizedEmail)) return { error: new Error('Use your fixed password for this test account.') }
    return supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true } })
  }

  const verifyEmailOtp = async (email, token) => supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.replace(/\D/g, ''),
    type: 'email'
  })

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    setSession(null)
    setProfile(null)
    setProfileError(null)
  }

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id, session.user.email, session.user.app_metadata?.provider)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    role: profile?.role ?? null,
    loading,
    signInWithGoogle,
    signInTestAccount,
    requestEmailOtp,
    verifyEmailOtp,
    signOut,
    refreshProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
