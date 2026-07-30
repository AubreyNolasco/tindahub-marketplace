import { useEffect, useState } from 'react'
import { CreditCard, X, Eye, Check } from 'lucide-react'
import { peso } from '../../utils/format'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

const STATUS_COLORS = {
  active: 'bg-teal-100 text-teal-700',
  expired: 'bg-coral-100 text-coral-600',
  cancelled: 'bg-ink/10 text-ink/60'
}

const SUBSCRIPTION_PLANS = [
  { months: 6, label: 'Starter · 6 Months', amount: 1599 },
  { months: 12, label: 'Growth · 1 Year', amount: 2799, recommended: true },
  { months: 24, label: 'Pro · 2 Years', amount: 4999 }
]

function effectiveStatus(sub) {
  if (!sub) return null
  if (sub.status === 'cancelled') return 'cancelled'
  if (new Date(sub.expires_at) < new Date()) return 'expired'
  return 'active'
}

function SubscriptionModal({ profile, onClose, onSaved }) {
  const sub = profile.subscriptions
  const [status, setStatus] = useState(sub?.status || 'active')
  const [planMonths, setPlanMonths] = useState(12)
  const [extendExisting, setExtendExisting] = useState(Boolean(sub?.expires_at && new Date(sub.expires_at) > new Date()))
  const [saving, setSaving] = useState(false)

  const selectedPlan = SUBSCRIPTION_PLANS.find((plan) => plan.months === planMonths)
  const calculateExpiry = () => {
    const existingExpiry = sub?.expires_at ? new Date(sub.expires_at) : null
    const base = extendExisting && existingExpiry && existingExpiry > new Date() ? existingExpiry : new Date()
    const expiry = new Date(base)
    expiry.setMonth(expiry.getMonth() + planMonths)
    return expiry
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const expiresAt = calculateExpiry()
    const payload = {
      status,
      expires_at: expiresAt.toISOString(),
      is_free: false,
      updated_at: new Date().toISOString()
    }
    const { error } = sub
      ? await supabase.from('subscriptions').update(payload).eq('id', sub.id)
      : await supabase.from('subscriptions').insert({ owner_id: profile.id, started_at: new Date().toISOString(), ...payload })
    if (error) {
      setSaving(false)
      toast.error(error.message)
      return
    }
    if (profile.role === 'merchant') {
      const { error: merchantError } = await supabase.from('merchant_profiles').update({
        subscription_active: status === 'active',
        subscription_expires_at: expiresAt.toISOString()
      }).eq('id', profile.id)
      if (merchantError) {
        setSaving(false)
        toast.error(merchantError.message)
        return
      }
    }
    setSaving(false)
    toast.success(`${selectedPlan.label} subscription applied until ${formatDate(expiresAt)}.`)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-scrim/40 backdrop-blur-sm">
      <div className="card max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl text-ink">Manage Subscription</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-teal-50 text-ink/50 hover:text-ink/80 transition-colors">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-ink/60 mb-4">
          {profile.merchant_profiles?.business_name || profile.full_name} <span className="capitalize">({profile.role})</span>
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ink/70">Choose Subscription Plan</label>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <button key={plan.months} type="button" onClick={() => setPlanMonths(plan.months)}
                  className={`relative rounded-xl border-2 p-3 text-center transition ${planMonths === plan.months ? 'border-teal-500 bg-teal-50 shadow-sm' : 'border-black/10 hover:border-teal-200'}`}>
                  {plan.recommended && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-teal-600 px-2 py-0.5 text-[8px] font-bold uppercase text-white">Best value</span>}
                  {planMonths === plan.months && <Check size={14} className="absolute right-1.5 top-1.5 text-teal-600" />}
                  <span className="block text-xs font-semibold text-ink/65">{plan.label}</span>
                  <span className="mt-1 block font-display text-lg font-bold text-teal-700">{peso(plan.amount)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-ink/70">Status</label>
            <select className="input-field mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {sub?.expires_at && <label className="flex items-start gap-3 rounded-xl bg-surface-inset p-4 text-sm text-ink/70"><input type="checkbox" className="mt-0.5" checked={extendExisting} onChange={(e) => setExtendExisting(e.target.checked)} /><span><strong className="block text-ink">Extend existing subscription</strong>Start the selected plan after the current expiration ({formatDate(sub.expires_at)}). Uncheck to start from today.</span></label>}

          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
            <div className="flex justify-between text-sm"><span className="text-ink/60">Selected plan</span><strong className="text-ink">{selectedPlan.label} · {peso(selectedPlan.amount)}</strong></div>
            <div className="mt-2 flex justify-between text-sm"><span className="text-ink/60">New expiration</span><strong className="text-teal-700">{formatDate(calculateExpiry())}</strong></div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Applying plan...' : `Apply ${selectedPlan.label} Plan`}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Subscriptions() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [requests, setRequests] = useState([])
  const [proofUrls, setProofUrls] = useState({})

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const [{ data, error }, { data: requestData, error: requestError }] = await Promise.all([
      supabase.from('profiles').select('*, merchant_profiles!merchant_profiles_id_fkey(business_name), subscriptions(*)').eq('role', 'merchant').order('created_at', { ascending: false }),
      supabase.from('subscription_requests').select('*, profiles!subscription_requests_owner_id_fkey(full_name,role, merchant_profiles!merchant_profiles_id_fkey(business_name))').order('created_at', { ascending: false })
    ])
    if (error || requestError) toast.error(error?.message || requestError?.message)
    setProfiles(data || [])
    setRequests((requestData || []).filter((request) => request.profiles?.role === 'merchant'))
    setLoading(false)
  }

  const viewProof = async (request) => {
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(request.proof_url, 300)
    if (error) return toast.error(error.message)
    setProofUrls((current) => ({ ...current, [request.id]: data.signedUrl }))
  }

  const review = async (request, approved) => {
    const adminNotes = approved ? null : window.prompt('Reason for rejection (optional):') || null
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = approved
      ? await supabase.rpc('activate_merchant_application', { p_merchant_id: request.owner_id, p_subscription_request_id: request.id })
      : await supabase.from('subscription_requests').update({ status: 'rejected', admin_notes: adminNotes, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', request.id)
    if (error) return toast.error(error.message)
    toast.success(approved ? 'Subscription approved and Merchant account activated.' : 'Subscription request rejected.')
    load()
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Subscriptions</h1>

      <h2 className="font-semibold text-ink mb-3">Payment Requests</h2>
      {requests.length === 0 ? <EmptyState icon={CreditCard} title="No subscription payment requests" /> : (
        <div className="space-y-3 mb-8">
          {requests.map((request) => (
            <div key={request.id} className="card p-5 flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-ink">{request.profiles?.merchant_profiles?.business_name || request.profiles?.full_name}</p>
                <p className="text-sm text-ink/60">{request.plan_months} months · {peso(request.amount)} · {request.payment_method?.toUpperCase()}</p>
                <p className="text-xs text-ink/40">Ref# {request.reference_number || '—'} · {formatDate(request.created_at)}</p>
                {proofUrls[request.id] && <img src={proofUrls[request.id]} alt="Payment proof" className="max-h-52 rounded-lg mt-3" />}
                {request.admin_notes && <p className="text-xs text-coral-600 mt-1">{request.admin_notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                {!proofUrls[request.id] && <button onClick={() => viewProof(request)} className="btn-secondary text-xs px-3 py-1.5 flex gap-1"><Eye size={13} /> Proof</button>}
                <span className={`badge ${request.status === 'approved' ? 'bg-teal-100 text-teal-700' : request.status === 'rejected' ? 'bg-coral-100 text-coral-600' : 'bg-mango-100 text-mango-600'}`}>{request.status}</span>
                {request.status === 'pending' && <>
                  <button onClick={() => review(request, true)} className="btn-primary text-xs px-3 py-1.5 flex gap-1"><Check size={13} /> Approve</button>
                  <button onClick={() => review(request, false)} className="bg-coral-100 text-coral-600 rounded-xl text-xs font-semibold px-3 py-1.5"><X size={13} /></button>
                </>}
              </div>
            </div>
          ))}
        </div>
      )}

      {profiles.length === 0 ? (
        <EmptyState icon={CreditCard} title="No Merchants found" message="Merchant subscriptions will appear here." />
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => {
            const status = effectiveStatus(p.subscriptions)
            return (
              <div key={p.id} className="card p-5 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-semibold text-ink">
                    {p.merchant_profiles?.business_name || p.full_name}
                    <span className="text-ink/40 font-normal capitalize"> · {p.role}</span>
                  </p>
                  {p.subscriptions ? (
                    <p className="text-sm text-ink/60">
                      {p.subscriptions.is_free && <span className="text-teal-600 font-medium">Free</span>}
                      {p.subscriptions.is_free && ' · '}
                      Expires {formatDate(p.subscriptions.expires_at)}
                    </p>
                  ) : (
                    <p className="text-sm text-ink/40">No subscription record</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {status && <span className={`badge capitalize ${STATUS_COLORS[status]}`}>{status}</span>}
                  <button onClick={() => setEditing(p)} className="btn-secondary text-xs px-3 py-1.5">
                    {p.subscriptions ? 'Manage' : 'Grant Subscription'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <SubscriptionModal profile={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  )
}
