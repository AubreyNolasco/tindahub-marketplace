import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../ui/Spinner'
import ProfileLoadError from '../auth/ProfileLoadError'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, profileError, role, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Spinner />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // `profile` can still be null for a beat right after `loading` flips to
  // false -- loadProfile's setProfile and the outer .finally()'s
  // setLoading(false) land in separate microtask ticks, so this render can
  // briefly see loading:false with profile not yet committed. Treating
  // that the same as "no profile" used to redirect straight to
  // /onboarding -> /auth/continue -> role home, silently discarding
  // whatever deep link (e.g. /admin/approval-center) the user actually
  // requested. Wait it out here instead, same pattern AuthContinue/
  // Onboarding already use for this exact state.
  if (!profile) {
    if (profileError) return <ProfileLoadError message={profileError} onSignOut={signOut} />
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Spinner />
      </div>
    )
  }

  if (profile.onboarding_completed === false) {
    return <Navigate to="/onboarding" replace />
  }

  // Reseller/Merchant land in their dashboard immediately after signup.
  // Real operations (posting products, placing orders, ...) stay blocked
  // server-side (RLS) until account_status/business_permit_status are
  // approved -- see RestrictedAccountBanner for the in-dashboard notice,
  // and /pending-approval, /merchant-permit remain reachable as normal
  // pages rather than forced redirects.

  // Merchant free/paid subscription lapsed: this is a stricter, full
  // dashboard lockout (not just "can't operate"), so it redirects unlike
  // the checks above. Chat Support stays reachable even while locked out,
  // so a merchant can still reach Admin for help.
  const merchantExpiry = profile?.merchant_profiles?.subscription_expires_at
  const subscriptionLocked = role === 'merchant' && (!merchantExpiry || new Date(merchantExpiry) <= new Date())
  if (subscriptionLocked && location.pathname !== '/merchant/support') {
    return <Navigate to="/subscription-locked" replace />
  }

  // A route's allow-list is authoritative. Admin pages that need a shared
  // screen already include `admin` explicitly; silently bypassing every
  // allow-list let an Admin enter Merchant/Reseller workspaces by editing
  // the URL, which also made role-specific queries run under the wrong role.
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return children
}
