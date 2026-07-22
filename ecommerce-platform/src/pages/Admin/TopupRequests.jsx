import { useEffect, useState } from 'react'
import { Banknote, Check, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, TOPUP_STATUS_STYLES, TOPUP_STATUS_LABELS } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function TopupRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [proofUrls, setProofUrls] = useState({})

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('topup_requests')
      .select('*, profiles!topup_requests_owner_id_fkey(full_name, role, merchant_profiles!merchant_profiles_id_fkey(business_name))')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error(error.message)
    }
    setRequests(data || [])
    setLoading(false)
  }

  const viewProof = async (request) => {
    if (!request.proof_url) return
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(request.proof_url, 300)
    if (error) {
      toast.error('Hindi ma-load ang proof of payment.')
      return
    }
    setProofUrls((p) => ({ ...p, [request.id]: data.signedUrl }))
  }

  const review = async (request, approve) => {
    let admin_notes = null
    if (!approve) {
      admin_notes = window.prompt('Dahilan ng pag-reject (optional):') || null
    }
    const { error } = await supabase
      .from('topup_requests')
      .update({
        status: approve ? 'approved' : 'rejected',
        admin_notes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', request.id)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(approve ? 'Na-approve ang top-up at na-credit sa wallet.' : 'Na-reject ang top-up request.')
    load()
  }

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Mga Top-Up Request</h1>

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
        <EmptyState icon={Banknote} title="Walang top-up request" message="Walang request sa filter na ito." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="card p-5 flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-ink">
                  {r.profiles?.merchant_profiles?.business_name || r.profiles?.full_name}
                  <span className="text-ink/40 font-normal capitalize"> · {r.profiles?.role}</span>
                </p>
                <p className="text-sm text-ink/60">{peso(r.amount)} via {r.method?.toUpperCase()} · Ref# {r.reference_number || '—'}</p>
                <p className="text-xs text-ink/40">{formatDate(r.created_at)}</p>
                {r.status === 'rejected' && r.admin_notes && (
                  <p className="text-xs text-coral-600 mt-1">Dahilan: {r.admin_notes}</p>
                )}
                {proofUrls[r.id] && (
                  <img src={proofUrls[r.id]} alt="proof" className="max-h-48 rounded-lg mt-3" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {r.proof_url && !proofUrls[r.id] && (
                  <button onClick={() => viewProof(r)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                    <Eye size={13} /> Proof
                  </button>
                )}
                <span className={`badge capitalize ${TOPUP_STATUS_STYLES[r.status]}`}>{TOPUP_STATUS_LABELS[r.status]}</span>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
