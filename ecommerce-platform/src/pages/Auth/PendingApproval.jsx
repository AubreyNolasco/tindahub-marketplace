import { Link, Navigate } from 'react-router-dom'
import { Clock3, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'

export default function PendingApproval() {
  const { user, profile, role, loading, signOut } = useAuth()
  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  if (profile?.account_status === 'approved' || role === 'admin') {
    return <Navigate to={role === 'merchant' ? '/merchant' : role === 'admin' ? '/admin' : '/reseller'} replace />
  }
  const rejected = profile?.account_status === 'rejected'
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
      <div className="card p-8 max-w-lg text-center">
        <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${rejected ? 'bg-coral-100 text-coral-600' : 'bg-mango-100 text-mango-600'}`}>
          {rejected ? <ShieldCheck size={27} /> : <Clock3 size={27} />}
        </div>
        <h1 className="font-display font-bold text-2xl text-ink">{rejected ? 'Application needs attention' : 'Awaiting Admin Approval'}</h1>
        <p className="text-ink/60 mt-3">
          {rejected
            ? 'Hindi na-approve ang payment application. Makipag-ugnayan sa Admin para sa detalye at muling pagsusumite.'
            : role === 'merchant'
              ? 'Sinusuri ng Admin ang subscription at payment screenshot mo. Magagamit ang Merchant account pagkatapos ma-approve.'
              : 'Sinusuri ng Admin ang initial wallet top-up mo. Magagamit ang Reseller account at wallet pagkatapos ma-approve.'}
        </p>
        {role === 'merchant' && !rejected && <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"><Link to="/merchant-permit" className="btn-primary">Submit Business Permit</Link><Link to="/choose-subscription" className="btn-secondary">Choose Subscription</Link></div>}
        <button onClick={signOut} className="btn-secondary mt-6">Sign out</button>
      </div>
    </div>
  )
}
