import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { canAccessAdmin } from '../../config/adminPermissions'

export default function AdminPermissionRoute({ permission, adminOnly = false, children }) {
  const { profile } = useAuth()
  if (adminOnly ? profile?.role !== 'admin' : !canAccessAdmin(profile, permission)) {
    console.warn('[DIAG] AdminPermissionRoute -> /', { adminOnly, permission, role: profile?.role })
    return <Navigate to="/" replace />
  }
  return children
}
