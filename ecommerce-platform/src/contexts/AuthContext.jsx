import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// The database raises plain technical error codes (they're also matched by
// exact string elsewhere, e.g. DeviceAccessGuard/MfaGuard), so they can't be
// reworded at the source. Translate the ones a real user can hit here before
// they ever reach ProfileLoadError, instead of showing "DEVICE_APPROVAL_
// REQUIRED" or a raw Postgres message to someone who isn't a developer.
const FRIENDLY_PROFILE_ERRORS = {
  DEVICE_APPROVAL_REQUIRED: "We're verifying this device against your account's security settings. If this takes more than a few seconds, sign in again.",
  MFA_VERIFICATION_REQUIRED: 'Extra verification is required for this account. Please sign in again.',
}
const friendlyProfileError = (message) => FRIENDLY_PROFILE_ERRORS[message] || 'We could not load your account profile. Please refresh or sign in again.'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [deviceAccessStatus, setDeviceAccessStatus] = useState('signed_out')
  const [loading, setLoading] = useState(true)
  const activeUserIdRef = useRef(null)
  const profileRequestRef = useRef(0)

  const loadProfile = useCallback(async (userId, _userEmail = '', provider = '', isRetry = false) => {
    const requestId = ++profileRequestRef.current
    const isCurrentRequest = () => activeUserIdRef.current === userId && profileRequestRef.current === requestId
    setProfileError(null)
    if (!userId) {
      setProfile(null)
      return
    }
    if (provider === 'google') {
      const { error: syncError } = await supabase.rpc('sync_google_profile')
      if (syncError) {
        console.error('Unable to sync Google profile:', syncError.message)
        // sync_google_profile's own profile write can race the separate
        // request_device_access() call DeviceAccessGuard fires on the same
        // fresh login (see 20260810000100_fresh_login_reclaims_device_on_
        // mutation.sql) -- one retry after that reclaim has had a moment to
        // land clears the transient case without showing an error at all.
        if (syncError.message === 'DEVICE_APPROVAL_REQUIRED' && !isRetry) {
          await new Promise((resolve) => setTimeout(resolve, 1500))
          // Check the actual current session rather than trusting the
          // userId this call closed over -- if the user signed out (or
          // switched accounts) during the wait, the delayed retry must
          // not resurrect profile/error state for a session that's gone.
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          if (currentSession?.user?.id !== userId) return
          return loadProfile(userId, _userEmail, provider, true)
        }
        if (!isCurrentRequest()) return
        setProfile(null)
        setProfileError(friendlyProfileError(syncError.message))
        return
      }
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (!isCurrentRequest()) return
    if (error) {
      console.error('Failed to load profile:', error.message)
      setProfile(null)
      setProfileError(friendlyProfileError(error.message))
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
        if (isCurrentRequest()) setProfile({ ...data, staff_access: staffAccess || { permissions: [], active: false } })
        return
      }
      if (data?.role === 'merchant') {
        const { data: merchantProfile, error: merchantError } = await supabase.rpc('get_my_merchant_profile')
        if (merchantError) console.error('Failed to load merchant profile:', merchantError.message)
        if (isCurrentRequest()) setProfile({ ...data, merchant_profiles: merchantProfile || null })
      } else {
        if (isCurrentRequest()) setProfile(data)
      }
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) setProfileError(error.message)
      setSession(session)
      activeUserIdRef.current = session?.user?.id || null
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
      activeUserIdRef.current = session?.user?.id || null
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
    activeUserIdRef.current = null
    profileRequestRef.current += 1
    setSession(null)
    setProfile(null)
    setProfileError(null)
    setDeviceAccessStatus('signed_out')
  }
  const signOutLocal = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' })
    activeUserIdRef.current = null; profileRequestRef.current += 1
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
