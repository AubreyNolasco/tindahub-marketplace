import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, UserRound, Phone, MapPin, MessageSquare, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

const STATUS_STYLES = {
  pending: 'bg-mango-100 text-mango-700',
  confirmed: 'bg-teal-50 text-teal-700',
  completed: 'bg-teal-500/15 text-teal-700',
  cancelled: 'bg-coral-100 text-coral-700'
}

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

export default function ReferralRequests() {
  const { user } = useAuth()
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_merchant_referrals')
    if (error) toast.error(error.message)
    setReferrals(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const confirmReferral = async (id) => {
    setProcessing(id)
    const { error } = await supabase.rpc('confirm_referral_appointment', { p_appointment_id: id })
    if (error) { toast.error(error.message); setProcessing(null); return }
    toast.success('Referral confirmed.')
    load()
    setProcessing(null)
  }

  const completeReferral = async (id) => {
    if (!confirm('Mark this appointment as completed? This will transfer the referral fee from your wallet to the reseller.')) return
    setProcessing(id)
    const { error } = await supabase.rpc('complete_referral_appointment', { p_appointment_id: id })
    if (error) {
      if (error.message.includes('INSUFFICIENT_MERCHANT_BALANCE')) {
        toast.error('Insufficient wallet balance. Please top up your wallet first.')
      } else {
        toast.error(error.message)
      }
      setProcessing(null)
      return
    }
    toast.success('Appointment completed! Referral fee transferred to reseller.')
    load()
    setProcessing(null)
  }

  const cancelReferral = async (id) => {
    if (!confirm('Cancel this referral?')) return
    setProcessing(id)
    const { error } = await supabase.rpc('cancel_referral_appointment', { p_appointment_id: id })
    if (error) { toast.error(error.message); setProcessing(null); return }
    toast.success('Referral cancelled.')
    load()
    setProcessing(null)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Referrals</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">Incoming Referrals</h1>
          <p className="mt-1 text-sm text-ink/50">Resellers refer their customers to your clinic services.</p>
        </div>
        <button onClick={load} className="btn-secondary p-2.5"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : referrals.length === 0 ? (
        <EmptyState icon={UserRound} title="No referrals yet" message="When Resellers refer customers to your clinic, they will appear here." />
      ) : (
        <div className="space-y-4">
          {referrals.map((ref) => (
            <div key={ref.id} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-black/[0.04] bg-cream/80 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-100">
                    <UserRound size={18} className="text-teal-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{ref.customer_name}</p>
                    <p className="text-xs text-ink/50">Referred by <span className="font-semibold text-teal-700">{ref.reseller_name}</span></p>
                  </div>
                </div>
                <span className={`badge shrink-0 ${STATUS_STYLES[ref.status] || 'bg-ink/10 text-ink/60'}`}>
                  {STATUS_LABELS[ref.status] || ref.status}
                </span>
              </div>

              <div className="px-5 py-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm text-ink/60"><Clock size={14} className="shrink-0" /> Service: <span className="font-semibold text-ink">{ref.service_name || '—'}</span></p>
                    {ref.customer_phone && <p className="flex items-center gap-2 text-sm text-ink/60"><Phone size={14} className="shrink-0" /> {ref.customer_phone}</p>}
                    {ref.customer_address && <p className="flex items-center gap-2 text-sm text-ink/60"><MapPin size={14} className="shrink-0" /> {ref.customer_address}</p>}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-ink/60">Service Fee: <span className="font-bold text-teal-700">{peso(ref.service_fee || 0)}</span></p>
                    <p className="text-sm text-ink/60">Referral Fee: <span className="font-bold text-mango-600">{peso(ref.referral_fee)}</span></p>
                    <p className="text-xs text-ink/40">Referred {formatDate(ref.created_at)}</p>
                  </div>
                </div>

                {(ref.status === 'pending' || ref.status === 'confirmed') && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-black/[0.04] pt-4">
                    {ref.status === 'pending' && (
                      <button
                        onClick={() => confirmReferral(ref.id)}
                        disabled={processing === ref.id}
                        className="btn-primary flex items-center gap-1.5 text-sm"
                      >
                        <CheckCircle size={15} /> Confirm Referral
                      </button>
                    )}
                    {ref.status === 'confirmed' && (
                      <button
                        onClick={() => completeReferral(ref.id)}
                        disabled={processing === ref.id}
                        className="btn-primary flex items-center gap-1.5 text-sm bg-teal-700"
                      >
                        <CheckCircle size={15} /> Complete (Auto-Pay Referral Fee)
                      </button>
                    )}
                    <button
                      onClick={() => cancelReferral(ref.id)}
                      disabled={processing === ref.id}
                      className="btn-secondary flex items-center gap-1.5 text-sm text-coral-600"
                    >
                      <XCircle size={15} /> Cancel
                    </button>
                  </div>
                )}

                {ref.status === 'completed' && ref.completed_at && (
                  <div className="mt-3 rounded-xl bg-teal-50 px-4 py-3 text-xs text-teal-700">
                    Completed {formatDate(ref.completed_at)} · Referral fee {peso(ref.referral_fee)} sent to {ref.reseller_name}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

