import { Banknote, Printer } from 'lucide-react'
import { peso, formatDate, TOPUP_STATUS_STYLES, TOPUP_STATUS_LABELS } from '../../utils/format'
import EmptyState from '../ui/EmptyState'
import { printReceipt } from '../../utils/receipt'

export default function TopupRequestList({ requests }) {
  if (requests.length === 0) {
    return <EmptyState icon={Banknote} title="No top-up requests yet" message="Your submitted requests will appear here." />
  }

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-ink">{peso(r.amount)}</p>
            <p className="text-xs text-ink/50">{r.method?.toUpperCase()} · {formatDate(r.created_at)}</p>
            {r.status === 'rejected' && r.admin_notes && (
              <p className="text-xs text-coral-600 mt-1">{r.admin_notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2"><button type="button" onClick={()=>printReceipt({title:'Wallet Top-Up',reference:r.reference_number||r.id,status:r.status,date:formatDate(r.created_at),rows:[{label:'Amount',value:peso(r.amount)},{label:'Method',value:r.method?.toUpperCase()},{label:'Admin notes',value:r.admin_notes||'None'}],note:'Wallet funds become available only after Admin approval.'})} className="grid h-10 w-10 place-items-center rounded-xl border border-teal-100 text-teal-700 hover:bg-teal-50" title="Print receipt" aria-label="Print top-up receipt"><Printer size={16}/></button><span className={`badge ${TOPUP_STATUS_STYLES[r.status]}`}>{TOPUP_STATUS_LABELS[r.status]}</span></div>
        </div>
      ))}
    </div>
  )
}
