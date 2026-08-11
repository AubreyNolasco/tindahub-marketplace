import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../ui/Spinner'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Spinner />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!profile || profile.onboarding_completed === false) {
    console.warn('[DIAG] ProtectedRoute -> /onboarding', { hasProfile: !!profile, onboarding_completed: profile?.onboarding_completed, path: location.pathname, role })
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
