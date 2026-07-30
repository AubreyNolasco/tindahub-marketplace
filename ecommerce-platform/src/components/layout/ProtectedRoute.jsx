import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../ui/Spinner'

export default function ProtectedRoute({ children, allowedRoles, allowUnverifiedMerchant = false }) {
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

  if (!['admin', 'staff'].includes(role) && profile?.account_status && profile.account_status !== 'approved') {
    return <Navigate to="/pending-approval" replace />
  }

  if (!allowUnverifiedMerchant && role === 'merchant' && profile?.merchant_profiles?.business_permit_status !== 'approved') {
    return <Navigate to="/merchant-permit" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role) && role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}
