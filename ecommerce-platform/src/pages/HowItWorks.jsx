import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import SiteSubNav from '../components/home/SiteSubNav'
import RegistrationCalendar from '../components/registration/RegistrationCalendar'
import GrowthSection from '../components/home/GrowthSection'
import useHomeContent from '../hooks/useHomeContent'
import useScrollToHash from '../hooks/useScrollToHash'
import { benefits, categoryCards, transactionSteps } from '../config/homeContent'

export default function HowItWorks() {
  const content = useHomeContent()
  useScrollToHash()

  return <div className="overflow-hidden bg-bg">
    <SiteSubNav />

    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">How It Works</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">A clearer path from signup to payment.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Everything you need to know about how JOM HUB works — the marketplace flow, what you get, and how to get started.</p>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">Categories</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">Built for every role in the ecosystem.</h2>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categoryCards.map(({ title, description, icon: Icon, href }) => (
          <Link key={title} to={href} className="group rounded-[1.5rem] border border-black/[0.06] bg-surface p-5 shadow-sm transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-md">
            <span className="grid h-12 w-12 place-items-center rounded-[1rem] bg-teal-50 text-teal-700 transition group-hover:bg-teal-700 group-hover:text-white"><Icon size={20} /></span>
            <h3 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-ink/65">{description}</p>
          </Link>
        ))}
      </div>
    </section>

    {content.sections?.benefits !== false && <section id="benefits" className="mx-auto max-w-7xl scroll-mt-32 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Built for real business</p><h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Everything you need to buy, sell, and grow with confidence.</h2><p className="mt-4 text-ink/60">JOM HUB replaces scattered chats, manual records, and disconnected payment tracking — all in one organized workspace.</p></div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{benefits.map(({ icon: Icon, title, text }) => <div key={title} className="group rounded-2xl border border-black/[0.06] bg-surface p-5 shadow-card transition hover:-translate-y-1 hover:border-teal-100 hover:shadow-soft"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-600 group-hover:text-white"><Icon size={19} /></span><h3 className="mt-4 font-display text-base font-bold text-ink sm:text-lg">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/60">{text}</p></div>)}</div>
    </section>}

    {content.sections?.process !== false && <section className="bg-teal-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-mango-300">How JOM HUB works</p><h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">A clearer path from discovery to payment.</h2></div><Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-mango-300">View the marketplace <ArrowRight size={16} /></Link></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{transactionSteps.map(({ icon: Icon, title, text }, index) => <div key={title} className="relative rounded-2xl border border-white/10 bg-white/[0.07] p-5"><span className="absolute right-4 top-4 font-display text-3xl font-bold text-white/[0.08]">0{index + 1}</span><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mango-500 text-ink"><Icon size={21} /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>)}</div>
      </div>
    </section>}

    <GrowthSection />

    <RegistrationCalendar />
  </div>
}
