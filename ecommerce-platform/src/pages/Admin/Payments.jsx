import { useEffect, useState } from 'react'
import { CreditCard, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { peso, formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

const STATUS_COLORS = {
  pending: 'bg-mango-100 text-mango-600',
  submitted: 'bg-teal-100 text-teal-700',
  verified: 'bg-teal-500/15 text-teal-700',
  rejected: 'bg-coral-100 text-coral-600'
}

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [proofUrls, setProofUrls] = useState({})

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('payments')
      .select('*, orders(order_number, merchant_profiles(business_name))')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setPayments(data || [])
    setLoading(false)
  }

  const viewProof = async (payment) => {
    if (!payment.proof_url) return
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(payment.proof_url, 300)
    if (!error) setProofUrls((p) => ({ ...p, [payment.id]: data.signedUrl }))
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Lahat ng Payment</h1>

      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments yet" />
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-mono text-sm text-ink/70">{p.orders?.order_number}</p>
                <p className="text-sm text-ink/60">{p.orders?.merchant_profiles?.business_name} · {p.method?.toUpperCase()}</p>
                <p className="text-xs text-ink/40">{formatDate(p.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{peso(p.amount)}</span>
                <span className={`badge capitalize ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                {p.proof_url && (
                  <button onClick={() => viewProof(p)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                    <Eye size={13} /> Proof
                  </button>
                )}
              </div>
              {proofUrls[p.id] && (
                <img src={proofUrls[p.id]} alt="proof" className="max-h-40 rounded-lg w-full" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
