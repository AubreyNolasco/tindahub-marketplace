import { Landmark, Printer } from 'lucide-react'
import { peso, formatDate, TOPUP_STATUS_STYLES, TOPUP_STATUS_LABELS } from '../../utils/format'
import EmptyState from '../ui/EmptyState'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { printReceipt } from '../../utils/receipt'

export default function WithdrawalRequestList({ requests }) {
  if (requests.length === 0) {
    return <EmptyState icon={Landmark} title="No withdrawal requests yet" message="Your submitted requests will appear here." />
  }
  const viewProof=async request=>{const{data,error}=await supabase.storage.from('withdrawal-proofs').createSignedUrl(request.transfer_proof_url,300);if(error)return toast.error(error.message);window.open(data.signedUrl,'_blank','noopener,noreferrer')}

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-ink">{peso(r.amount)}</p>
            <p className="text-xs text-ink/50">{r.bank_name} · {r.bank_account_number} · {formatDate(r.created_at)}</p>
            {r.scheduled_for && !r.sent_at && <p className="mt-1 text-xs font-semibold text-mango-700">Admin schedule: {new Date(r.scheduled_for).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})}</p>}
            {r.sent_at && <><p className="mt-1 text-xs font-semibold text-teal-700">Sent {formatDate(r.sent_at)} · Transfer ref: {r.transfer_reference}</p>{r.transfer_proof_url&&<button onClick={()=>viewProof(r)} className="mt-1 text-xs font-bold text-teal-700 underline">View transfer proof</button>}</>}
            {r.status === 'rejected' && r.admin_notes && (
              <p className="text-xs text-coral-600 mt-1">{r.admin_notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2"><button type="button" onClick={()=>printReceipt({title:'Wallet Withdrawal',reference:r.transfer_reference||r.id,status:r.sent_at?'sent':r.status,date:formatDate(r.created_at),rows:[{label:'Amount',value:peso(r.amount)},{label:'Bank',value:r.bank_name},{label:'Account name',value:r.bank_account_name},{label:'Account number',value:r.bank_account_number},{label:'Scheduled for',value:r.scheduled_for?formatDate(r.scheduled_for):'Not scheduled'},{label:'Sent at',value:r.sent_at?formatDate(r.sent_at):'Not sent'}],note:'Verify the destination account and transfer reference before relying on this record.'})} className="grid h-10 w-10 place-items-center rounded-xl border border-teal-100 text-teal-700 hover:bg-teal-50" title="Print receipt" aria-label="Print withdrawal receipt"><Printer size={16}/></button><span className={`badge ${r.sent_at?'bg-teal-100 text-teal-800':TOPUP_STATUS_STYLES[r.status]}`}>{r.sent_at?'Sent':r.status==='approved'?'Scheduled / Approved':TOPUP_STATUS_LABELS[r.status]}</span></div>
        </div>
      ))}
    </div>
  )
}
