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

  if (allowedRoles && !allowedRoles.includes(role) && role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}
