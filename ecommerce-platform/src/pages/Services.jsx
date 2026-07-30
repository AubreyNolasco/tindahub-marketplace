import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Check, Stethoscope, TrendingUp, Truck } from 'lucide-react'
import SiteSubNav from '../components/home/SiteSubNav'
import { featuredHighlights } from '../config/homeContent'

export default function Services() {
  return <div className="overflow-hidden bg-bg">
    <SiteSubNav />

    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">Services</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Referral programs and delivery partners.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Extra ways to earn and to move products faster, on top of your marketplace store.</p>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-[2rem] border border-black/[0.06] bg-white/80 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-surface/80 sm:p-8">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">Featured experiences</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">Premium tools for your next growth step.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {featuredHighlights.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-[1.5rem] border border-black/[0.06] bg-surface p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-700 text-white"><Icon size={18} /></span>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-ink/65">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* ===== CLINIC REFERRAL PATH ===== */}
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] rounded-[2rem] border border-teal-100 bg-surface shadow-2xl shadow-teal-900/[0.06] overflow-hidden">
        <div className="relative p-6 sm:p-10 lg:p-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-mango-700"><Stethoscope size={15} /> Clinic Referral System</span>
          <h2 className="mt-5 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">Earn by referring customers to a clinic.</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/60 sm:text-base">Refer your customer to a partner dental or optical clinic and earn a referral fee. <strong>No upfront cost</strong> — the clinic pays you after the appointment.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-500/10"><Stethoscope size={20} className="text-teal-700" /><h3 className="mt-3 text-sm font-bold text-ink">Dental & Optical Clinics</h3><p className="mt-1 text-xs leading-5 text-ink/50">Partner clinics offering dental cleaning, eye checkups, and more.</p></div>
            <div className="rounded-2xl border border-mango-200 bg-mango-100/60 p-4 dark:border-mango-700 dark:bg-mango-500/10"><TrendingUp size={20} className="text-mango-700" /><h3 className="mt-3 text-sm font-bold text-ink">Referral Fee</h3><p className="mt-1 text-xs leading-5 text-ink/50">Earn a referral fee that is automatically transferred to your wallet.</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/clinics" className="btn-accent inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold">View partner clinics <ArrowRight size={16} /></Link>
            <Link to="/signup" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">Sign up as a Reseller</Link>
          </div>
        </div>
        <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden p-6 sm:p-10">
          <img
            src="/hero/dental-clinic.jpg"
            alt="Modern dental clinic interior"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-mango-800/85 via-mango-700/75 to-amber-900/85" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(242,169,59,0.25),transparent_50%)]" />
          <div className="relative w-full max-w-sm">
            <div className="rounded-[1.75rem] border border-white/25 bg-white/20 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl text-ink transition-transform duration-300 hover:scale-[1.02] dark:bg-black/30">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/90 text-mango-700 shadow-lg"><Stethoscope size={24} /></span>
                <div><p className="text-xs font-semibold text-ink/60">CLINIC REFERRAL</p><p className="font-bold text-ink">Earn a referral fee</p></div>
              </div>
              <div className="mt-5 grid gap-3">
                <div className="flex items-center gap-3 rounded-xl bg-white/95 p-3 shadow-sm transition hover:shadow-md dark:bg-surface/95"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700 text-xs font-bold">1</span><p className="text-xs font-semibold text-ink">Choose a clinic service</p></div>
                <div className="flex items-center gap-3 rounded-xl bg-white/95 p-3 shadow-sm transition hover:shadow-md dark:bg-surface/95"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700 text-xs font-bold">2</span><p className="text-xs font-semibold text-ink">Refer your customer</p></div>
                <div className="flex items-center gap-3 rounded-xl bg-white/95 p-3 shadow-sm transition hover:shadow-md dark:bg-surface/95"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700 text-xs font-bold">3</span><p className="text-xs font-semibold text-ink">Earn after the appointment</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ===== LALAMOVE INTEGRATION ===== */}
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-surface shadow-2xl shadow-teal-900/[0.06]">
        <div className="grid lg:grid-cols-[1fr_1fr]">
          <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden p-6 sm:p-10">
            <img
              src="/hero/lalamove-delivery.jpg"
              alt="Motorcycle delivery rider on a city street"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-teal-900/90 via-teal-800/85 to-teal-950/95" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(22,121,75,0.3),transparent_50%)]" />
            <div className="relative w-full max-w-sm">
              <div className="rounded-[1.75rem] border border-white/25 bg-white/15 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl transition-transform duration-300 hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/90 text-teal-700 shadow-lg"><Truck size={24} /></span>
                  <div><p className="text-xs text-white/80">LALAMOVE</p><p className="font-bold text-white drop-shadow-sm">Real-time delivery</p></div>
                </div>
                <div className="mt-4 rounded-xl bg-white/20 p-4 text-center backdrop-blur-sm">
                  <p className="text-3xl font-bold text-white">🚚</p>
                  <p className="mt-2 text-sm font-semibold text-white">Metro Manila · Cebu</p>
                </div>
                <p className="mt-3 text-xs text-white/70 text-center">Connect your Lalamove API key for instant delivery quotes.</p>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-10 lg:p-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-teal-700"><Truck size={15} /> Lalamove Integration</span>
            <h2 className="mt-5 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">Faster shipping with Lalamove.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-ink/60 sm:text-base">Connect your Lalamove account to get real-time delivery quotes. Resellers can opt in for faster shipping on their orders.</p>
            <div className="mt-6 grid gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-surface p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Real-time delivery pricing from the Lalamove API</p></div>
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-surface p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Metro Manila and Cebu areas supported</p></div>
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-surface p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Connect your own Lalamove account</p></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/reseller/delivery" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">Set up Lalamove <ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ===== REAL ESTATE REFERRAL ===== */}
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-surface shadow-2xl shadow-teal-900/[0.06]">
        <div className="grid lg:grid-cols-[1fr_1fr]">
          <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden p-6 sm:p-10">
            <img
              src="/hero/real-estate-property.jpg"
              alt="Modern house exterior with stone facade"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-mango-800/85 via-amber-800/80 to-mango-900/90" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(242,169,59,0.2),transparent_50%)]" />
            <div className="relative w-full max-w-sm">
              <div className="rounded-[1.75rem] border border-white/25 bg-white/15 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl transition-transform duration-300 hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/90 text-mango-700 shadow-lg"><Building2 size={24} /></span>
                  <div><p className="text-xs text-white/80">REAL ESTATE</p><p className="font-bold text-white drop-shadow-sm">Property referral fees</p></div>
                </div>
                <div className="mt-4 rounded-xl bg-white/20 p-4 text-center backdrop-blur-sm">
                  <p className="text-3xl font-bold text-white">🏠</p>
                  <p className="mt-2 text-sm font-semibold text-white">Condos · Houses · Lots</p>
                </div>
                <p className="mt-3 text-xs text-white/70 text-center">Refer your customer to a partner real estate agent and earn a referral fee.</p>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-10 lg:p-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-mango-700"><Building2 size={15} /> Real Estate Referral</span>
            <h2 className="mt-5 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">Earn by referring property buyers.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-ink/60 sm:text-base">Refer your customer to a partner real estate agent for a condo, house and lot, or commercial property. <strong>No upfront cost</strong> — earn a referral fee after a successful transaction.</p>
            <div className="mt-6 grid gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-surface p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Partner real estate agents with verified properties</p></div>
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-surface p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Condos, houses, lots, and commercial spaces</p></div>
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-surface p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Referral fee credited automatically to your wallet</p></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/clinics" className="btn-accent inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold">View properties <ArrowRight size={16} /></Link>
              <Link to="/signup" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">Sign up as a Reseller</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
}
