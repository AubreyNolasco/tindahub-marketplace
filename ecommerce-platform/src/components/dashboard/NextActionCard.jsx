import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NextActionCard({ title, description, to, action, complete = false }) {
  return <section className={`mb-6 flex flex-col gap-4 rounded-2xl border p-5 shadow-card sm:flex-row sm:items-center sm:justify-between ${complete ? 'border-teal-100 bg-teal-50' : 'border-mango-300 bg-mango-100/55'}`}>
    <div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${complete ? 'bg-teal-700 text-white' : 'bg-mango-500 text-ink'}`}><CheckCircle2 size={21}/></span><div><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-ink/45">Recommended next action</p><h2 className="mt-1 font-display text-lg font-bold text-ink">{title}</h2><p className="mt-1 text-sm leading-6 text-ink/60">{description}</p></div></div>
    <Link to={to} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${complete ? 'bg-teal-700 text-white' : 'bg-ink text-white'}`}>{action}<ArrowRight size={16}/></Link>
  </section>
}
