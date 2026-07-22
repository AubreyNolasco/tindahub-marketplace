import { useEffect, useState } from 'react'
import { Landmark, Check, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, TOPUP_STATUS_STYLES, TOPUP_STATUS_LABELS } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function WithdrawalRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*, profiles!withdrawal_requests_owner_id_fkey(full_name, role, merchant_profiles!merchant_profiles_id_fkey(business_name))')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setRequests(data || [])
    setLoading(false)
  }

  const review = async (request, approve) => {
    let admin_notes = null
    let scheduled_for = null
    if (!approve) {
      admin_notes = window.prompt('Reason for rejection (optional):') || null
    } else {
      const schedule = window.prompt('When can the transfer be sent? Example: 2026-07-23 14:00. Leave blank for as soon as available.')
      if (schedule) { const parsed = new Date(schedule); if (Number.isNaN(parsed.getTime())) return toast.error('Invalid processing schedule.'); scheduled_for = parsed.toISOString() }
    }
    const { error } = await supabase
      .from('withdrawal_requests')
      .update({
        status: approve ? 'approved' : 'rejected',
        admin_notes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        scheduled_for
      })
      .eq('id', request.id)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(approve ? 'Approved and scheduled. Mark it Sent only after the actual transfer.' : 'Withdrawal rejected and refunded to the wallet.')
    load()
  }

  const markSent = async (request) => {
    const reference = window.prompt('Enter the bank or e-wallet transfer reference:')
    if (!reference?.trim()) return
    const { error } = await supabase.rpc('mark_withdrawal_sent', { p_request_id: request.id, p_transfer_reference: reference.trim() })
    if (error) return toast.error(error.message)
    toast.success('Withdrawal marked as Sent.')
    load()
  }

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Withdrawal Requests</h1>

      <div className="flex gap-2 mb-6">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${
              filter === f ? 'bg-teal-500 text-white' : 'bg-white text-ink/60 border border-black/10'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Landmark} title="No withdrawal requests" message="No requests match this filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="card p-5 flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-ink">
                  {r.profiles?.merchant_profiles?.business_name || r.profiles?.full_name}
                  <span className="text-ink/40 font-normal capitalize"> · {r.profiles?.role}</span>
                </p>
                <p className="text-sm text-ink/60">{peso(r.amount)} · {r.bank_name}</p>
                <p className="text-sm text-ink/60">{r.bank_account_name} · {r.bank_account_number}</p>
                <p className="text-xs text-ink/40">{formatDate(r.created_at)}</p>
                {r.scheduled_for && !r.sent_at && <p className="mt-1 text-xs font-semibold text-mango-700">Planned send time: {new Date(r.scheduled_for).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})}</p>}
                {r.sent_at && <p className="mt-1 text-xs font-semibold text-teal-700">Sent {formatDate(r.sent_at)} · Ref {r.transfer_reference}</p>}
                {r.status === 'rejected' && r.admin_notes && (
                  <p className="text-xs text-coral-600 mt-1">Reason: {r.admin_notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge capitalize ${r.sent_at?'bg-teal-100 text-teal-800':TOPUP_STATUS_STYLES[r.status]}`}>{r.sent_at?'Sent':r.status==='approved'?'Scheduled / Approved':TOPUP_STATUS_LABELS[r.status]}</span>
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => review(r, true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      <Check size={13} /> Approve
                    </button>
                    <button onClick={() => review(r, false)} className="text-xs px-3 py-1.5 rounded-xl bg-coral-100 text-coral-600 font-semibold flex items-center gap-1">
                      <X size={13} /> Reject
                    </button>
                  </>
                )}
                {r.status === 'approved' && !r.sent_at && <button onClick={() => markSent(r)} className="btn-primary flex items-center gap-1 px-3 py-1.5 text-xs"><Send size={13} /> Mark Sent</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
