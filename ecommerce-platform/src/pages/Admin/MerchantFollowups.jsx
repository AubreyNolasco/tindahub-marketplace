import { useEffect, useState } from 'react'
import { CalendarClock, Check, Clock3, UserCog, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Tabs from '../../components/ui/Tabs'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'

const STATUS_STYLES = {
  pending: 'bg-mango-100 text-mango-600 dark:bg-mango-500/15 dark:text-mango-300',
  approved: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  rejected: 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-300'
}

// datetime-local inputs read/write in the browser's local time, not UTC --
// toISOString() would silently shift the displayed value by the local
// timezone offset (e.g. 8 hours off in the Philippines).
const pad = (n) => String(n).padStart(2, '0')
const toLocalInputDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
const toInputDate = (value) => (value ? toLocalInputDate(new Date(value)) : '')

export default function MerchantFollowups() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [reviewModal, setReviewModal] = useState(null) // { id, business_name, operate_until }
  const [adjustModal, setAdjustModal] = useState(null) // { merchant_id, business_name, operate_until }

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_admin_merchant_followups')
    if (error) toast.error(error.message)
    setRequests(data || [])
    setLoading(false)
  }

  const openReview = (request) => setReviewModal({ id: request.id, business_name: request.business_name, operate_until: '' })

  const reject = async (request) => {
    const notes = window.prompt('Reason for declining this follow-up request:') || ''
    const { error } = await supabase.rpc('admin_review_merchant_followup', {
      p_request_id: request.id,
      p_approved: false,
      p_notes: notes
    })
    if (error) return toast.error(error.message)
    toast.success('Follow-up request declined.')
    load()
  }

  const confirmApproval = async () => {
    if (!reviewModal) return
    if (!reviewModal.operate_until) return toast.error('Choose when temporary access should expire.')
    const { error } = await supabase.rpc('admin_review_merchant_followup', {
      p_request_id: reviewModal.id,
      p_approved: true,
      p_operate_until: new Date(reviewModal.operate_until).toISOString(),
      p_notes: ''
    })
    setReviewModal(null)
    if (error) return toast.error(error.message)
    toast.success('Follow-up approved. The merchant can now operate until the date you set.')
    load()
  }

  const openAdjust = (request) => setAdjustModal({
    merchant_id: request.merchant_id,
    business_name: request.business_name,
    operate_until: toInputDate(request.operate_until)
  })

  const confirmAdjust = async () => {
    if (!adjustModal) return
    if (!adjustModal.operate_until) return toast.error('Choose the new expiry date.')
    const { error } = await supabase.rpc('admin_adjust_merchant_operate_grace', {
      p_merchant_id: adjustModal.merchant_id,
      p_operate_until: new Date(adjustModal.operate_until).toISOString()
    })
    setAdjustModal(null)
    if (error) return toast.error(error.message)
    toast.success('Temporary access duration updated.')
    load()
  }

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)
  const minDate = toLocalInputDate(new Date(Date.now() + 3600000))

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-1">Merchant Follow-Up Requests</h1>
      <p className="mb-6 text-sm text-ink/50">Merchants ask here for temporary permission to operate while their business permit is still under review.</p>

      <Tabs options={['pending', 'approved', 'rejected', 'all']} value={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState icon={UserCog} title="No follow-up requests" message="No requests match this filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="card p-5 flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-ink">{r.business_name || r.full_name}<span className="text-ink/40 font-normal"> · {r.email}</span></p>
                <p className="mt-1 text-sm text-ink/60">{r.reason || 'No reason given.'}</p>
                <p className="mt-1 text-xs text-ink/40">Requested {formatDate(r.requested_at)} · Permit status: {r.business_permit_status}</p>
                {r.status !== 'pending' && r.admin_notes && <p className="mt-1 text-xs text-coral-600">Admin note: {r.admin_notes}</p>}
                {r.status === 'approved' && r.operate_until && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                    <Clock3 size={13} /> Access until {formatDate(r.operate_until)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => openReview(r)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      <Check size={13} /> Approve
                    </button>
                    <Button onClick={() => reject(r)} variant="danger-chip" size="sm" icon={X}>Reject</Button>
                  </>
                )}
                {r.status === 'approved' && (
                  <button onClick={() => openAdjust(r)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                    <CalendarClock size={13} /> Adjust duration
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!reviewModal} onClose={() => setReviewModal(null)} title="Grant temporary access" subtitle={reviewModal?.business_name} icon={CalendarClock} size="sm">
        <p className="text-sm text-ink/60">Choose how long this merchant may operate before their permit is fully approved.</p>
        <label className="mt-4 block text-sm font-semibold text-ink/70">
          Access expires
          <input
            type="datetime-local"
            required
            className="input-field mt-1.5"
            value={reviewModal?.operate_until || ''}
            min={minDate}
            onChange={(e) => setReviewModal({ ...reviewModal, operate_until: e.target.value })}
          />
        </label>
        <div className="mt-5 flex gap-3">
          <button onClick={confirmApproval} className="btn-primary flex-1">Approve follow-up</button>
          <button onClick={() => setReviewModal(null)} className="btn-secondary flex-1">Cancel</button>
        </div>
      </Modal>

      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title="Adjust access duration" subtitle={adjustModal?.business_name} icon={CalendarClock} size="sm">
        <label className="block text-sm font-semibold text-ink/70">
          New expiry
          <input
            type="datetime-local"
            required
            className="input-field mt-1.5"
            value={adjustModal?.operate_until || ''}
            onChange={(e) => setAdjustModal({ ...adjustModal, operate_until: e.target.value })}
          />
        </label>
        <div className="mt-5 flex gap-3">
          <button onClick={confirmAdjust} className="btn-primary flex-1">Save duration</button>
          <button onClick={() => setAdjustModal(null)} className="btn-secondary flex-1">Cancel</button>
        </div>
      </Modal>
    </div>
  )
}
