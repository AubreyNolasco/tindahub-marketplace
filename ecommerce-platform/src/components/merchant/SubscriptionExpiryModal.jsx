import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate } from '../../utils/format'

const WARNING_DAYS = 7

export default function SubscriptionExpiryModal() {
  const { user } = useAuth()
  const [sub, setSub] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('subscriptions')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => setSub(data))
  }, [user])

  if (!sub || dismissed) return null

  const expiresAt = new Date(sub.expires_at)
  const now = new Date()
  const daysLeft = Math.ceil((expiresAt - now) / 86400000)
  const isExpired = expiresAt < now || sub.status !== 'active'
  const isExpiringSoon = !isExpired && daysLeft <= WARNING_DAYS

  if (!isExpired && !isExpiringSoon) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/40 backdrop-blur-sm">
      <div className="w-full max-w-sm card p-6 text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isExpired ? 'bg-coral-100' : 'bg-mango-100'}`}>
          <AlertTriangle className={isExpired ? 'text-coral-600' : 'text-mango-600'} size={26} />
        </div>
        <h2 className="font-display font-bold text-lg text-ink mb-1">
          {isExpired ? 'Tapos na ang Subscription Mo' : 'Malapit nang Mag-expire ang Subscription Mo'}
        </h2>
        <p className="text-sm text-ink/60 mb-5">
          {isExpired
            ? `Nag-expire ang subscription mo noong ${formatDate(sub.expires_at)}. Makipag-ugnayan sa admin para i-renew.`
            : `Mag-e-expire ang subscription mo sa loob ng ${daysLeft} araw (${formatDate(sub.expires_at)}). Makipag-ugnayan sa admin para i-renew.`}
        </p>
        <button onClick={() => setDismissed(true)} className="btn-primary w-full">
          Naintindihan
        </button>
      </div>
    </div>
  )
}
