import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [deviceAccessStatus, setDeviceAccessStatus] = useState('signed_out')
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
      const { error: loginHistoryError } = await supabase.rpc('record_login_event', {
        p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent
      })
      if (loginHistoryError) console.error('Unable to record login history:', loginHistoryError.message)

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
      if (session?.user) {
        setDeviceAccessStatus('checking')
        await loadProfile(session.user.id, session.user.email, session.user.app_metadata?.provider)
      } else {
        setDeviceAccessStatus('signed_out')
      }
    }).catch((error) => {
      console.error('Failed to initialize authentication:', error)
      setProfileError(error.message || 'Unable to initialize authentication.')
    }).finally(() => setLoading(false))

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session?.user) {
        if (event === 'SIGNED_IN') setDeviceAccessStatus('checking')
        setTimeout(() => loadProfile(session.user.id, session.user.email, session.user.app_metadata?.provider), 0)
      } else {
        setProfile(null)
        setProfileError(null)
        setDeviceAccessStatus('signed_out')
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

  const signInWithPassword = async (email, password) => {
    return supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })
  }

  const requestEmailOtp = async (email, captchaToken) => {
    const normalizedEmail = email.trim().toLowerCase()
    return supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true, captchaToken: captchaToken || undefined }
    })
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
    setDeviceAccessStatus('signed_out')
  }
  const signOutLocal = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' })
    setSession(null); setProfile(null); setProfileError(null); setDeviceAccessStatus('signed_out')
  }, [])

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id, session.user.email, session.user.app_metadata?.provider)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    deviceAccessStatus,
    setDeviceAccessStatus,
    role: profile?.role ?? null,
    loading,
    signInWithGoogle,
    signInWithPassword,
    requestEmailOtp,
    verifyEmailOtp,
    signOut,
    signOutLocal,
    refreshProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
