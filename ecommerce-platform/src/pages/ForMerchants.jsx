import { Link } from 'react-router-dom'
import { ArrowRight, Check, Store } from 'lucide-react'
import SiteSubNav from '../components/home/SiteSubNav'
import useHomeContent from '../hooks/useHomeContent'
import { plans } from '../config/homeContent'

export default function ForMerchants() {
  const content = useHomeContent()

  return <div className="overflow-hidden bg-bg">
    <SiteSubNav />

    {content.sections?.subscription !== false && <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16" id="subscribe">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700"><Store size={14} /> For Merchants</span><h1 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">How to subscribe and open your store</h1><p className="mt-4 leading-7 text-ink/60">Create a Merchant profile and you'll land in your dashboard right away with a <strong className="text-ink">free 6-month subscription</strong> — no payment needed to start. Upload your business permit to unlock posting products, or request temporary access while it's under review. Renew anytime before your free 6 months ends to keep your dashboard active.</p>
        <div className="mt-6 space-y-3">{['Enter your Gmail, type the 6-digit OTP, and select Merchant.', 'Complete your business details — your dashboard opens immediately with a free 6-month subscription.', 'Upload a valid business permit to unlock posting products, or request temporary access while it\'s reviewed.', 'Renew before your free 6 months ends so your dashboard stays open.'].map((text, index) => <div key={text} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">{index + 1}</span><p className="pt-0.5 text-sm leading-6 text-ink/65">{text}</p></div>)}</div>
        <Link to="/signup" className="mt-7 inline-flex items-center gap-2 font-semibold text-teal-700">Create a Merchant account <ArrowRight size={17} /></Link></div>
        <div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 text-center dark:border-teal-700 dark:bg-teal-500/10"><p className="font-display text-xl font-bold text-teal-800 dark:text-teal-300">Free for your first 6 months</p><p className="mt-1 text-xs leading-5 text-teal-700/80 dark:text-teal-300/70">Granted automatically at signup — no payment or approval needed to activate it.</p></div>
          <p className="mt-4 text-center text-xs font-semibold uppercase tracking-wider text-ink/40">Renew anytime after with</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">{plans.map((plan) => <div key={plan.duration} className={`relative rounded-2xl border bg-surface p-6 shadow-card ${plan.featured ? 'border-teal-500 ring-4 ring-teal-50' : 'border-black/[0.06]'}`}>{plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Recommended</span>}<p className="text-sm font-semibold text-ink/60">{plan.duration}</p><p className="mt-2 font-display text-3xl font-bold text-ink">{plan.price}</p><p className="mt-2 text-xs leading-5 text-ink/45">{plan.note}</p><div className="mt-5 space-y-2 text-xs text-ink/60"><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Store access</p><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Business reports</p><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Admin review</p></div></div>)}</div>
        </div>
      </div>
    </section>}
  </div>
}
