import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import ProfileLoadError from '../../components/auth/ProfileLoadError'
import { getAdminHomePath } from '../../config/adminPermissions'

export default function AuthContinue() {
  const { user, profile, role, loading, profileError, signOut } = useAuth()
  if (loading) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-bg"><Spinner /></div>
  if (user && !profile) return <ProfileLoadError message={profileError || 'Your account profile is missing.'} onSignOut={signOut} />
  if (!user) return <Navigate to="/login" replace />
  console.warn('[DIAG] AuthContinue mounted', { onboarding_completed: profile?.onboarding_completed, role, account_status: profile?.account_status })
  if (profile?.onboarding_completed === false) return <Navigate to="/onboarding" replace />
  if (!['admin', 'staff'].includes(role) && profile?.account_status !== 'approved') return <Navigate to="/pending-approval" replace />
  return <Navigate to={['admin', 'staff'].includes(role) ? getAdminHomePath(profile) : role === 'merchant' ? '/merchant' : '/reseller'} replace />
}
