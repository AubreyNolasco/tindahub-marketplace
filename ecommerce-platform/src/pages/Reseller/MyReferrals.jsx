import { useEffect, useState } from 'react'
import { Send, CheckCircle, Clock, XCircle, TrendingUp, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate } from '../../utils/format'
import DataTable from '../../components/ui/DataTable'
import ActionPopup, { DetailRow, DetailSection } from '../../components/ui/ActionPopup'
import { PageGuideButton } from '../../components/system/SystemGuide'

const STATUS_STYLES = {
  pending: 'bg-mango-100 text-mango-700',
  confirmed: 'bg-teal-50 text-teal-700',
  completed: 'bg-teal-500/15 text-teal-700',
  cancelled: 'bg-coral-100 text-coral-700'
}

export default function MyReferrals() {
  useAuth()
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRef, setSelectedRef] = useState(null)
  const [showDetail, setShowDetail] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_reseller_referrals')
    if (error) toast.error(error.message)
    setReferrals(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalEarned = referrals.filter((r) => r.status === 'completed').reduce((sum, r) => sum + Number(r.referral_fee), 0)
  const pendingFees = referrals.filter((r) => r.status === 'pending' || r.status === 'confirmed').reduce((sum, r) => sum + Number(r.referral_fee), 0)

  const columns = [
    { header: 'Customer', accessor: 'customer_name', sortable: true },
    { header: 'Clinic', render: (row) => row.merchant_name || '—', sortable: true },
    { header: 'Service', render: (row) => row.service_name || '—' },
    { header: 'Fee', accessor: 'referral_fee', format: 'currency', sortable: true },
    { header: 'Status', accessor: 'status', format: 'badge', sortable: true },
    { header: 'Date', accessor: 'created_at', format: 'date', sortable: true }
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Referrals</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">My Referrals</h1>
          <p className="mt-1 text-sm text-ink/50">Track customers you've referred to clinics and your earnings.</p>
        </div>
        <div className="flex items-center gap-2">
          <PageGuideButton pageKey="clinic-flow" />
          <button onClick={load} className="btn-secondary p-2.5" aria-label="Refresh referrals">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && referrals.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100"><Send size={20} className="text-teal-700" /></div>
              <div><p className="text-2xl font-bold text-ink">{referrals.length}</p><p className="text-xs text-ink/50">Total referrals</p></div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15"><TrendingUp size={20} className="text-teal-700" /></div>
              <div><p className="text-2xl font-bold text-teal-700">{peso(totalEarned)}</p><p className="text-xs text-ink/50">Earned (completed)</p></div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mango-100"><Clock size={20} className="text-mango-700" /></div>
              <div><p className="text-2xl font-bold text-mango-700">{peso(pendingFees)}</p><p className="text-xs text-ink/50">Pending payout</p></div>
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={referrals}
        loading={loading}
        searchPlaceholder="Search by customer, clinic..."
        emptyTitle="No referrals yet"
        emptyMessage="Browse clinics and refer your customers to earn referral fees."
        onView={(row) => { setSelectedRef(row); setShowDetail(true) }}
      />

      <ActionPopup
        open={showDetail}
        onClose={() => { setShowDetail(false); setSelectedRef(null) }}
        title={selectedRef?.customer_name || 'Referral Details'}
        subtitle={selectedRef?.merchant_name}
        size="md"
      >
        {selectedRef && (
          <>
            <div className="mb-3">
              <span className={`badge ${STATUS_STYLES[selectedRef.status] || 'bg-ink/10 text-ink/60'}`}>
                {selectedRef.status?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
            <DetailSection title="Customer">
              <DetailRow label="Name" value={selectedRef.customer_name} />
              <DetailRow label="Phone" value={selectedRef.customer_phone || '—'} />
              <DetailRow label="Address" value={selectedRef.customer_address || '—'} />
            </DetailSection>
            <DetailSection title="Service">
              <DetailRow label="Service" value={selectedRef.service_name || '—'} />
              <DetailRow label="Clinic" value={selectedRef.merchant_name} />
              <DetailRow label="Referral Fee" value={peso(selectedRef.referral_fee)} className="font-bold text-mango-600" />
            </DetailSection>
            <DetailSection title="Timeline">
              <DetailRow label="Referred" value={formatDate(selectedRef.created_at)} />
              {selectedRef.confirmed_at && <DetailRow label="Confirmed" value={formatDate(selectedRef.confirmed_at)} />}
              {selectedRef.completed_at && <DetailRow label="Completed" value={formatDate(selectedRef.completed_at)} />}
            </DetailSection>
            {selectedRef.status === 'completed' && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-700 font-semibold">
                <CheckCircle size={16} /> {peso(selectedRef.referral_fee)} credited to your wallet
              </div>
            )}
            {selectedRef.status === 'cancelled' && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-600">
                <XCircle size={16} /> This referral was cancelled
              </div>
            )}
          </>
        )}
      </ActionPopup>
    </div>
  )
}
