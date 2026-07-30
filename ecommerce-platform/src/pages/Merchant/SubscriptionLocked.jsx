import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Ban } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate } from '../../utils/format'
import Spinner from '../../components/ui/Spinner'

export default function SubscriptionLocked() {
  const { user, profile, role, loading, signOut } = useAuth()
  const [sub, setSub] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('subscriptions').select('is_free, expires_at').eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => setSub(data))
  }, [user])

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />

  const expiresAt = sub?.expires_at || profile?.merchant_profiles?.subscription_expires_at
  const expired = role === 'merchant' && expiresAt && new Date(expiresAt) <= new Date()
  if (role !== 'merchant' || !expired) {
    return <Navigate to={role === 'merchant' ? '/merchant' : role === 'admin' ? '/admin' : role === 'reseller' ? '/reseller' : '/'} replace />
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
      <div className="card p-8 max-w-lg text-center">
        <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 bg-coral-100 text-coral-600">
          <Ban size={27} />
        </div>
        <h1 className="font-display font-bold text-2xl text-ink">Your subscription has ended</h1>
        <p className="text-ink/60 mt-3">
          {sub?.is_free
            ? `Your free 6-month Merchant subscription expired on ${formatDate(expiresAt)}. Renew to get your dashboard back — post products, receive orders, and browse your workspace again.`
            : `Your Merchant subscription expired on ${formatDate(expiresAt)}. Renew to get your dashboard back.`}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/choose-subscription" className="btn-primary">Renew Subscription</Link>
          <button onClick={signOut} className="btn-secondary">Sign out</button>
        </div>
      </div>
    </div>
  )
}
