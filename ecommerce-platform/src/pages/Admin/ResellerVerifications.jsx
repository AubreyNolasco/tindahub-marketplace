import { useEffect, useState } from 'react'
import { IdCard, Check, X, Eye, FileWarning, Ban } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Tabs from '../../components/ui/Tabs'

const STATUS_COLORS = {
  missing: 'bg-ink/10 text-ink/60',
  pending: 'bg-mango-100 text-mango-700',
  approved: 'bg-teal-100 text-teal-700',
  rejected: 'bg-coral-100 text-coral-600'
}

const ACCOUNT_STATUS_COLORS = {
  pending: 'bg-mango-100 text-mango-700',
  approved: 'bg-teal-100 text-teal-700',
  rejected: 'bg-coral-100 text-coral-600',
  suspended: 'bg-ink/10 text-ink/60'
}

export default function ResellerVerifications() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_admin_reseller_verifications')
    if (error) toast.error(error.message)
    setRows(data || [])
    setLoading(false)
  }

  const viewDocument = async (path, label) => {
    if (!path) return toast.error(`No ${label} attached.`)
    const { data, error } = await supabase.storage.from('reseller-id-verification').createSignedUrl(path, 300)
    if (error) return toast.error(error.message)
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const review = async (row, approved) => {
    let notes = ''
    if (!approved) {
      const reason = window.prompt('Reason for rejecting this verification:', 'Please upload a clearer selfie and valid ID.')
      if (reason === null) return
      notes = reason || ''
    }
    const { error } = await supabase.rpc('review_reseller_id_verification', {
      p_user_id: row.id,
      p_approved: approved,
      p_notes: notes
    })
    if (error) return toast.error(error.message)
    toast.success(approved ? 'Verification approved.' : 'Verification rejected.')
    load()
  }

  const updateAccountStatus = async (row, status) => {
    if (status === 'suspended' && !window.confirm(`Suspend ${row.full_name}'s reseller account? They will not be able to place orders or manage customers until reinstated.`)) return
    const { error } = await supabase.from('profiles').update({ account_status: status }).eq('id', row.id)
    if (error) return toast.error(error.message)
    toast.success(status === 'suspended' ? 'Reseller account suspended.' : 'Reseller account reinstated.')
    load()
  }

  const filtered = filter === 'all' ? rows : rows.filter((r) => (r.id_verification_status || 'missing') === filter)

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Reseller ID Verification</h1>

      <Tabs options={['pending', 'approved', 'rejected', 'all']} value={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState icon={IdCard} title="No submissions" message="No reseller verifications match this filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const status = r.id_verification_status || 'missing'
            return (
              <div key={r.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{r.full_name}</p>
                  <p className="text-sm text-ink/60">{r.email} · {r.phone}</p>
                  <p className="text-xs text-ink/40">Joined {formatDate(r.created_at)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`badge capitalize ${STATUS_COLORS[status]}`}>ID verification: {status}</span>
                    <span className={`badge capitalize ${ACCOUNT_STATUS_COLORS[r.account_status] || 'bg-ink/10 text-ink/60'}`}>Account: {r.account_status}</span>
                    {!r.id_verification_selfie_url && !r.id_verification_document_url && (
                      <span className="flex items-center gap-1 text-xs text-coral-600"><FileWarning size={13} /> No documents</span>
                    )}
                  </div>
                  {status === 'rejected' && r.id_verification_notes && (
                    <p className="mt-2 text-xs leading-5 text-coral-600">Reason: {r.id_verification_notes}</p>
                  )}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  {r.id_verification_selfie_url && (
                    <button onClick={() => viewDocument(r.id_verification_selfie_url, 'selfie')} className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs">
                      <Eye size={13} /> Selfie
                    </button>
                  )}
                  {r.id_verification_document_url && (
                    <button onClick={() => viewDocument(r.id_verification_document_url, 'valid ID')} className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs">
                      <Eye size={13} /> Valid ID
                    </button>
                  )}
                  {status === 'pending' && (
                    <>
                      <button onClick={() => review(r, true)} className="btn-primary flex items-center gap-1 px-3 py-1.5 text-xs">
                        <Check size={13} /> Approve
                      </button>
                      <button onClick={() => review(r, false)} className="flex items-center gap-1 rounded-xl bg-coral-100 px-3 py-1.5 text-xs font-semibold text-coral-600">
                        <X size={13} /> Reject
                      </button>
                    </>
                  )}
                  {r.account_status === 'approved' && (
                    <button onClick={() => updateAccountStatus(r, 'suspended')} className="flex items-center gap-1 rounded-xl bg-ink/10 px-3 py-1.5 text-xs font-semibold text-ink/60">
                      <Ban size={13} /> Suspend
                    </button>
                  )}
                  {r.account_status === 'suspended' && (
                    <button onClick={() => updateAccountStatus(r, 'approved')} className="btn-primary px-3 py-1.5 text-xs">
                      Reinstate
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
