import { Landmark } from 'lucide-react'
import { peso, formatDate, TOPUP_STATUS_STYLES, TOPUP_STATUS_LABELS } from '../../utils/format'
import EmptyState from '../ui/EmptyState'

export default function WithdrawalRequestList({ requests }) {
  if (requests.length === 0) {
    return <EmptyState icon={Landmark} title="No withdrawal requests yet" message="Your submitted requests will appear here." />
  }

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-ink">{peso(r.amount)}</p>
            <p className="text-xs text-ink/50">{r.bank_name} · {r.bank_account_number} · {formatDate(r.created_at)}</p>
            {r.status === 'rejected' && r.admin_notes && (
              <p className="text-xs text-coral-600 mt-1">{r.admin_notes}</p>
            )}
          </div>
          <span className={`badge ${TOPUP_STATUS_STYLES[r.status]}`}>{TOPUP_STATUS_LABELS[r.status]}</span>
        </div>
      ))}
    </div>
  )
}
