import { useEffect,useState } from 'react'
import { BadgeCheck,Check,Clock3,FileCheck2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { peso } from '../../utils/format'
import { Link } from 'react-router-dom'

export default function ApprovalCenter(){const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[activateTarget,setActivateTarget]=useState(null),[activating,setActivating]=useState(false);const load=async()=>{setLoading(true);const{data,error}=await supabase.rpc('get_merchant_approval_queue');if(error)toast.error(error.message);setRows(data||[]);setLoading(false)};useEffect(()=>{load()},[]);const activate=async()=>{if(!activateTarget)return;setActivating(true);const{error}=await supabase.rpc('activate_merchant_application',{p_merchant_id:activateTarget.id,p_subscription_request_id:activateTarget.subscription_request_id});setActivating(false);if(error)return toast.error(error.message);toast.success('Merchant account activated.');setActivateTarget(null);load()};if(loading)return <div className="py-24"><Spinner/></div>;return <div className="mx-auto max-w-5xl px-4 py-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-bold">Merchant Approval Center</h1><p className="mt-1 text-sm text-ink/50">One checklist for permit, subscription payment, and final account activation.</p></div><Link to="/admin/merchants" className="btn-secondary text-sm">Review Permit Documents</Link></div><div className="mt-6 space-y-4">{rows.length?rows.map(row=>{const permit=row.permit_status==='approved',submitted=Boolean(row.subscription_request_id),paymentApproved=row.subscription_status==='approved',active=row.account_status==='approved'&&row.merchant_status==='approved';return <article key={row.id} className="card p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{row.business_name}</h2><p className="text-sm text-ink/50">{row.full_name} · {row.email}</p></div><span className={`badge ${active?'bg-teal-100 text-teal-700':'bg-mango-100 text-mango-700'}`}>{active?'Active':'Action required'}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Step done={permit} icon={FileCheck2} label="Permit approved"/><Step done={submitted} icon={BadgeCheck} label={submitted?`${row.plan_months} months · ${peso(row.amount)}`:'Payment request missing'}/><Step done={paymentApproved} icon={Check} label={paymentApproved?'Payment approved':row.subscription_status==='pending'?'Payment pending review':'Payment not approved'}/><Step done={active} icon={Check} label="Account activated"/></div>{!active&&<button disabled={!permit||row.subscription_status!=='pending'} onClick={()=>setActivateTarget(row)} className="btn-primary mt-5 disabled:opacity-40">Approve payment and activate</button>}</article>}):<EmptyState icon={Clock3} title="No Merchant applications"/>}</div>
  <ConfirmDialog
    open={!!activateTarget}
    onClose={()=>setActivateTarget(null)}
    onConfirm={activate}
    loading={activating}
    variant="primary"
    title="Activate merchant account?"
    message={`Activate ${activateTarget?.business_name}? This approves the reviewed subscription payment and opens the Merchant account.`}
    confirmText="Activate account"
  />
</div>}
function Step({done,icon:Icon,label}){return <div className={`flex items-center gap-3 rounded-xl p-3 ${done?'bg-teal-50 text-teal-800':'bg-surface-inset text-ink/50'}`}><Icon size={18}/><span className="text-xs font-bold">{label}</span></div>}
