import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../ui/Spinner'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, role, loading } = useAuth()

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

  if (allowedRoles && !allowedRoles.includes(role) && role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}
