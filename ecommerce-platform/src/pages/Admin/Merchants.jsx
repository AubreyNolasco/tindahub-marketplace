import { useEffect, useState } from 'react'
import { Store, Check, X, Ban, Eye, FileWarning } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

const STATUS_COLORS = {
  pending: 'bg-mango-100 text-mango-600',
  approved: 'bg-teal-100 text-teal-700',
  rejected: 'bg-coral-100 text-coral-600',
  suspended: 'bg-ink/10 text-ink/60'
}

export default function Merchants() {
  const [merchants, setMerchants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_admin_merchant_profiles')
    if (error) toast.error(error.message)
    setMerchants(data || [])
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('merchant_profiles').update({ status }).eq('id', id)
    if (error) {
      toast.error(error.message.includes('BUSINESS_PERMIT_NOT_APPROVED') ? 'Approve the business permit before approving this merchant.' : error.message)
      return
    }
    toast.success(`Merchant ${status}.`)
    load()
  }

  const viewPermit = async (merchant) => {
    if (!merchant.business_permit_url) return toast.error('No business permit attached.')
    const { data, error } = await supabase.storage.from('business-permits').createSignedUrl(merchant.business_permit_url, 300)
    if (error) return toast.error(error.message)
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const reviewPermit = async (merchant, approved) => {
    const notes = approved ? '' : window.prompt('Reason for rejecting this business permit:', 'Please upload a clearer and valid business permit.')
    if (!approved && notes === null) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('merchant_profiles').update({
      business_permit_status: approved ? 'approved' : 'rejected',
      business_permit_notes: notes || '',
      business_permit_reviewed_at: new Date().toISOString(),
      business_permit_reviewed_by: user?.id || null,
      ...(approved ? {} : { status: 'pending' })
    }).eq('id', merchant.id)
    if (error) return toast.error(error.message)
    toast.success(approved ? 'Business permit approved. You may now approve the merchant.' : 'Business permit rejected.')
    load()
  }

  const filtered = filter === 'all' ? merchants : merchants.filter((m) => m.status === filter)

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Merchants</h1>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
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
        <EmptyState icon={Store} title="No merchants" message="No merchants match this filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div key={m.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{m.business_name}</p>
                <p className="text-sm text-ink/60">{m.profile_full_name} · {m.profile_phone}</p>
                <p className="text-xs text-ink/40">Joined {formatDate(m.created_at)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2"><span className={`badge capitalize ${m.business_permit_status === 'approved' ? 'bg-teal-100 text-teal-700' : m.business_permit_status === 'rejected' ? 'bg-coral-100 text-coral-600' : 'bg-mango-100 text-mango-700'}`}>Permit: {m.business_permit_status || 'missing'}</span>{!m.business_permit_url && <span className="flex items-center gap-1 text-xs text-coral-600"><FileWarning size={13} /> No attachment</span>}</div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <span className={`badge capitalize ${STATUS_COLORS[m.status]}`}>{m.status}</span>
                {m.business_permit_url && <button onClick={() => viewPermit(m)} className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs"><Eye size={13} /> View permit</button>}
                {m.business_permit_status === 'pending' && <><button onClick={() => reviewPermit(m, true)} className="btn-primary flex items-center gap-1 px-3 py-1.5 text-xs"><Check size={13} /> Permit valid</button><button onClick={() => reviewPermit(m, false)} className="flex items-center gap-1 rounded-xl bg-coral-100 px-3 py-1.5 text-xs font-semibold text-coral-600"><X size={13} /> Reject permit</button></>}
                {m.status === 'pending' && m.business_permit_status === 'approved' && (
                  <>
                    <button onClick={() => updateStatus(m.id, 'approved')} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      <Check size={13} /> Approve
                    </button>
                    <button onClick={() => updateStatus(m.id, 'rejected')} className="text-xs px-3 py-1.5 rounded-xl bg-coral-100 text-coral-600 font-semibold flex items-center gap-1">
                      <X size={13} /> Reject
                    </button>
                  </>
                )}
                {m.status === 'approved' && (
                  <button onClick={() => updateStatus(m.id, 'suspended')} className="text-xs px-3 py-1.5 rounded-xl bg-ink/10 text-ink/60 font-semibold flex items-center gap-1">
                    <Ban size={13} /> Suspend
                  </button>
                )}
                {m.status === 'suspended' && m.business_permit_status === 'approved' && (
                  <button onClick={() => updateStatus(m.id, 'approved')} className="btn-primary text-xs px-3 py-1.5">
                    Reinstate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
