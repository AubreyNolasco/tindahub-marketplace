import { useEffect, useMemo, useState } from 'react'
import { Activity, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

const label = (value='') => value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase())

export default function ActivityLog(){
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[search,setSearch]=useState(''),[type,setType]=useState('all')
  useEffect(()=>{supabase.from('activity_audit_logs').select('*,profiles!activity_audit_logs_actor_id_fkey(full_name,role)').order('created_at',{ascending:false}).limit(500).then(({data,error})=>{if(error)toast.error(error.message);setRows(data||[]);setLoading(false)})},[])
  const types=useMemo(()=>[...new Set(rows.map(row=>row.entity_type))].sort(),[rows])
  const filtered=rows.filter(row=>(type==='all'||row.entity_type===type)&&`${row.entity_type} ${row.entity_id} ${row.action} ${row.profiles?.full_name||''}`.toLowerCase().includes(search.toLowerCase()))
  if(loading)return <div className="py-24"><Spinner/></div>
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><div><h1 className="font-display text-2xl font-bold">Activity Audit Log</h1><p className="mt-1 text-sm text-ink/50">Immutable operational history for sensitive marketplace records. Payment secrets and uploaded documents are not copied here.</p></div><div className="mt-6 grid gap-3 sm:grid-cols-[1fr_220px]"><label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35"/><input value={search} onChange={event=>setSearch(event.target.value)} className="input-field pl-10" placeholder="Search actor, record, or action"/></label><select value={type} onChange={event=>setType(event.target.value)} className="input-field"><option value="all">All record types</option>{types.map(value=><option key={value} value={value}>{label(value)}</option>)}</select></div><div className="mt-5 space-y-3">{filtered.length?filtered.map(row=><article key={row.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${row.action==='delete'?'bg-coral-100 text-coral-700':row.action==='insert'?'bg-teal-50 text-teal-700':'bg-mango-100 text-mango-700'}`}><Activity size={18}/></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink">{label(row.action)} {label(row.entity_type)}</p><p className="mt-1 break-all font-mono text-xs text-ink/45">{row.entity_id||'System record'}</p><p className="mt-1 text-xs text-ink/50">{row.profiles?.full_name||'System process'}{row.profiles?.role?` · ${label(row.profiles.role)}`:''} · {formatDate(row.created_at)}</p></div>{(row.old_status||row.new_status)&&<div className="text-xs sm:text-right"><p className="text-ink/40">Status change</p><p className="mt-1 font-bold text-ink">{label(row.old_status||'new')} → {label(row.new_status||'removed')}</p></div>}</article>):<EmptyState icon={Activity} title="No matching activity" message="New protected record changes will appear after the audit migration is active."/>}</div></div>
}
