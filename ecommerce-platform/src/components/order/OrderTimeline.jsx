import { Check, Clock3 } from 'lucide-react'

const stages=['confirmed','processing','shipped','completed']
const labels={confirmed:'Confirmed',processing:'Processing',shipped:'Shipped',completed:'Completed'}
const owners={confirmed:'Merchant reviews',processing:'Package + fee approval',shipped:'Reseller tracks',completed:'Transaction closed'}

export default function OrderTimeline({status}){
  if(status==='cancelled')return <div className="mt-4 rounded-xl border border-coral-200 bg-coral-50 p-3 text-sm font-bold text-coral-700">Order cancelled · Review the case and wallet record.</div>
  const current=Math.max(0,stages.indexOf(status))
  return <div className="mt-4" aria-label={`Order status: ${labels[status]||status}`}><div className="grid grid-cols-4">{stages.map((stage,index)=>{const done=index<=current;return <div key={stage} className="relative text-center"><div className={`absolute left-0 right-0 top-4 h-0.5 ${index===0?'left-1/2':''} ${index===stages.length-1?'right-1/2':''} ${index<=current?'bg-teal-600':'bg-black/10'}`}/><span className={`relative mx-auto grid h-8 w-8 place-items-center rounded-full border-2 ${done?'border-teal-600 bg-teal-600 text-white':'border-black/10 bg-surface text-ink/30'}`}>{index<current||status==='completed'?<Check size={14}/>:<Clock3 size={13}/>}</span><p className={`mt-2 text-[10px] font-bold sm:text-xs ${done?'text-teal-800':'text-ink/35'}`}>{labels[stage]}</p><p className="mt-0.5 hidden text-[9px] text-ink/40 sm:block">{owners[stage]}</p></div>})}</div></div>
}
