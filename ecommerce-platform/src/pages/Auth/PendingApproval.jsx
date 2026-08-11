import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Check, Clock3, ShieldCheck, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'

// Mirrors the two-item checklist Merchants already get here (permit +
// subscription) -- Resellers are blocked on the same two independent
// approvals (ID verification + first wallet top-up), but used to only
// get a single ID-verification button, with no link anywhere on this
// page toward the wallet top-up step they're also waiting on.
function ResellerChecklist({ profile }) {
  const [walletFunded, setWalletFunded] = useState(null)
  const [topupStatus, setTopupStatus] = useState(null)

  useEffect(() => {
    let active = true
    supabase.from('wallets').select('balance').eq('owner_id', profile.id).maybeSingle().then(({ data }) => {
      if (active) setWalletFunded((data?.balance || 0) > 0)
    })
    supabase.from('topup_requests').select('status').eq('owner_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (active) setTopupStatus(data?.status || null)
    })
    return () => { active = false }
  }, [profile.id])

  const idApproved = profile?.id_verification_status === 'approved'
  const idPending = profile?.id_verification_status === 'pending'
  const walletDone = walletFunded === true || topupStatus === 'approved'
  const walletPending = topupStatus === 'pending'

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <Link to="/verify-id" className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${idApproved ? 'border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-500/10' : 'border-line hover:border-teal-300'}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${idApproved ? 'bg-teal-600 text-white' : 'bg-surface-inset text-fg-muted'}`}>{idApproved ? <Check size={17} /> : <ShieldCheck size={17} />}</span>
        <div className="min-w-0"><p className="text-sm font-bold text-fg">Identity verification</p><p className="text-xs text-fg-muted">{idApproved ? 'Approved' : idPending ? 'Submitted — waiting on Admin' : 'Not started yet'}</p></div>
      </Link>
      <Link to="/reseller/wallet" className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${walletDone ? 'border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-500/10' : 'border-line hover:border-teal-300'}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${walletDone ? 'bg-teal-600 text-white' : 'bg-surface-inset text-fg-muted'}`}>{walletDone ? <Check size={17} /> : <Wallet size={17} />}</span>
        <div className="min-w-0"><p className="text-sm font-bold text-fg">Initial wallet top-up</p><p className="text-xs text-fg-muted">{walletDone ? 'Approved' : walletPending ? 'Submitted — waiting on Admin' : 'Not started yet'}</p></div>
      </Link>
    </div>
  )
}

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
      <div className="card w-full max-w-lg p-8 text-center">
        <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${rejected ? 'bg-coral-100 text-coral-600' : 'bg-mango-100 text-mango-600'}`}>
          {rejected ? <ShieldCheck size={27} /> : <Clock3 size={27} />}
        </div>
        <h1 className="font-display font-bold text-2xl text-ink">{rejected ? 'Application needs attention' : 'Awaiting Admin Approval'}</h1>
        <p className="text-ink/60 mt-3">
          {rejected
            ? 'Your payment application was not approved. Contact Admin for details and resubmission instructions.'
            : role === 'merchant'
              ? 'Admin is reviewing your subscription and payment screenshot. Your Merchant account will become available after approval.'
              : 'Admin is reviewing your initial wallet top-up and identity verification. Your Reseller account and wallet will become available after both are approved.'}
        </p>
        {role === 'merchant' && !rejected && <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"><Link to="/merchant-permit" className="btn-primary">Submit Business Permit</Link><Link to="/choose-subscription" className="btn-secondary">Choose Subscription</Link></div>}
        {role === 'reseller' && !rejected && <ResellerChecklist profile={profile} />}
        <button onClick={signOut} className="btn-secondary mt-6">Sign out</button>
      </div>
    </div>
  )
}
