import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown, ArrowRight, ArrowUp, Building2, CheckCircle2,
  Clock3, MailCheck, ShieldCheck, ShoppingBag,
  Sparkles, Stethoscope, Store, TrendingUp, Truck, UsersRound, X
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import JomBits from '../components/assistant/JomBits'
import SiteSubNav from '../components/home/SiteSubNav'
import useHomeContent from '../hooks/useHomeContent'
import { fallback, plans } from '../config/homeContent'

const safeInternalLink = (value, fallbackValue) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallbackValue
const safeImageUrl = (value, fallbackValue = '') => typeof value === 'string' && (value.startsWith('/') || value.startsWith('https://')) ? value : fallbackValue

function ScrollNav() {
  const [showUp, setShowUp] = useState(false)
  const [showDown, setShowDown] = useState(false)

  useEffect(() => {
    const update = () => {
      const scrolled = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      setShowUp(scrolled > 600)
      setShowDown(maxScroll - scrolled > 400)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])

  if (!showUp && !showDown) return null
  return (
    <div
      className="fixed z-[65] flex flex-col overflow-hidden rounded-full border border-white/10 bg-teal-950/75 shadow-2xl shadow-teal-950/40 ring-1 ring-white/5 backdrop-blur-xl"
      style={{ bottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 5.5rem)', right: 'max(1rem, env(safe-area-inset-right))' }}
    >
      {showUp && (
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Back to top" aria-label="Back to top"
          className="group flex flex-col items-center gap-1 px-4 py-3 text-white/80 transition-all hover:bg-white/10 hover:text-white">
          <ArrowUp size={17} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.14em]">Top</span>
        </button>
      )}
      {showUp && showDown && <span className="mx-3 h-px bg-white/10" />}
      {showDown && (
        <button type="button" onClick={() => window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' })} title="Scroll down" aria-label="Scroll down"
          className="group flex flex-col items-center gap-1 px-4 py-3 text-white/80 transition-all hover:bg-white/10 hover:text-white">
          <ArrowDown size={17} className="transition-transform duration-300 group-hover:translate-y-0.5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.14em]">Down</span>
        </button>
      )}
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  const content = useHomeContent()
  const [subscriptionPopup, setSubscriptionPopup] = useState(false)
  const [heroLoaded, setHeroLoaded] = useState(false)

  const closeSubscriptionPopup = () => {
    try { sessionStorage.setItem('rmhub_subscription_popup_seen', 'true') } catch { /* restricted storage */ }
    setSubscriptionPopup(false)
  }

  const heroRadius = content.hero_border === 'square' ? 'rounded-none' : content.hero_border === 'soft' ? 'rounded-xl' : 'rounded-[1.75rem]'

  return <div className="overflow-hidden bg-bg">
    {subscriptionPopup && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-scrim/65 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Join JOM HUB">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-surface shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-800 to-teal-600 px-4 py-5 text-white sm:px-7 sm:py-6">
          <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-mango-400/20 blur-2xl" />
          <button type="button" onClick={closeSubscriptionPopup} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white sm:right-4 sm:top-4" aria-label="Close"><X size={19} /></button>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-mango-200"><Sparkles size={14} /> Grow with JOM HUB</span>
          <h2 className="mt-3 max-w-lg pr-6 font-display text-2xl font-extrabold leading-tight sm:text-3xl">Turn your products and connections into a growing business.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-teal-50/75">Join the trusted marketplace built for Filipino Merchants and Resellers â€” with organized orders, secure workflows, wallets, reports, campaigns, and direct communication.</p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="subscription-audience grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5 dark:border-teal-800 dark:bg-teal-500/10"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-700 text-white"><Store size={21} /></span><h3 className="mt-4 font-display text-lg font-bold text-ink">For Merchants</h3><p className="mt-2 text-sm leading-6 text-ink/60">Build your digital store, reach more Resellers, and manage inventory and orders.</p></div>
            <div className="rounded-2xl border border-mango-300 bg-mango-100/45 p-5 dark:border-mango-700 dark:bg-mango-500/10"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mango-500 text-ink"><UsersRound size={21} /></span><h3 className="mt-4 font-display text-lg font-bold text-ink">For Resellers</h3><p className="mt-2 text-sm leading-6 text-ink/60">Find trusted suppliers, get quantity discounts, and track your sales.</p></div>
          </div>
          <div className="mt-3 rounded-xl border border-black/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700 sm:text-xs">Merchants get 6 months free â€” renew anytime after with</p><div className="mt-2 grid grid-cols-3 gap-1.5 text-center">{plans.map((plan) => <div key={plan.duration} className={`rounded-lg px-1 py-2 ${plan.featured ? 'bg-teal-700 text-white' : 'bg-surface-inset text-ink'}`}><p className="text-[9px] font-semibold opacity-70 sm:text-[11px]">{plan.duration}</p><p className="mt-0.5 whitespace-nowrap font-display text-sm font-bold sm:text-base">{plan.price}</p></div>)}</div><p className="mt-2 text-center text-[10px] leading-4 text-ink/45 sm:text-xs">No payment needed to activate your free 6-month subscription at signup.</p></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Link to="/signup" onClick={closeSubscriptionPopup} className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 text-sm">Join JOM HUB <ArrowRight size={16} /></Link><button type="button" onClick={closeSubscriptionPopup} className="btn-secondary flex-1 py-2.5 text-sm">Explore the homepage</button></div>
        </div>
      </div>
    </div>}
    {content.announcement?.enabled && <div style={{ background: content.announcement.background, color: content.announcement.color }} className="relative z-20 px-4 py-2.5 text-center text-xs font-semibold sm:text-sm"><span>{content.announcement.text}</span>{content.announcement.link_text && <Link to={safeInternalLink(content.announcement.link_url, '/signup')} className="ml-2 inline-flex items-center gap-1 font-bold underline decoration-white/30 underline-offset-2">{content.announcement.link_text} <ArrowRight size={13} /></Link>}</div>}

    <SiteSubNav />

    {/* ===== HERO SECTION ===== */}
    <section className="relative">
      <div className="absolute inset-x-0 top-0 -z-0 h-[700px] bg-[radial-gradient(circle_at_80%_15%,rgba(242,169,59,0.18),transparent_28%),radial-gradient(circle_at_10%_15%,rgba(22,121,75,0.14),transparent_28%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-10">
        <div className="order-2 lg:order-1">
          <span className="animate-in-delay-1 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3.5 py-2 text-xs font-bold text-teal-700 shadow-sm backdrop-blur"><Sparkles size={14} className="text-mango-600" /> {content.eyebrow}</span>
          <h1 className="animate-in-delay-2 mt-4 max-w-2xl font-display text-responsive-hero font-extrabold leading-[1.05] tracking-tight text-ink">{content.title}</h1>
          <p className="animate-in-delay-3 mt-3 max-w-xl text-responsive-subtitle leading-7 text-ink/65">{content.description}</p>
          <div className="animate-in-delay-3 mt-4 inline-flex max-w-full items-center gap-3 rounded-2xl border border-teal-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-teal-900/50 dark:bg-black/40">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><MailCheck size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Secure 6-digit email verification</p><p className="text-xs leading-5 text-ink/50">A one-time code sent to your Gmail â€” no password needed.</p></div>
          </div>
          <div className="animate-in-delay-4 mt-6 flex flex-col gap-3 sm:flex-row">
            {!user && <Link to="/signup" style={{ backgroundColor: content.hero_accent }} className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0">{content.hero_button || 'Start your business'} <ArrowRight size={18} /></Link>}
            {user ? <Link to="/catalog" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3.5">Explore products <ShoppingBag size={17} /></Link> : <Link to="/login" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3.5">Sign in to view products <ShoppingBag size={17} /></Link>}
          </div>
          <div className="animate-in-delay-4 mt-5 grid max-w-xl grid-cols-1 gap-2 text-responsive-body font-medium text-ink/55 sm:grid-cols-3">
            {['Protected product catalog', 'Curated Reseller stores', 'Mobile-ready access'].map((item) => <span key={item} className="flex items-center gap-1.5"><CheckCircle2 size={16} className="shrink-0 text-teal-500" /> {item}</span>)}
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-2xl lg:max-w-none order-1 lg:order-2">
          <div className="absolute -inset-3 rotate-2 rounded-[2rem] bg-teal-100/80 hidden sm:block" />
          <div className={`relative overflow-hidden ${heroRadius} shadow-2xl shadow-teal-900/20 animate-in`}>
            <img
              src={safeImageUrl(content.hero_image, fallback.hero_image)}
              alt="Filipino market vendors running their small business in Baguio"
              className={`aspect-[4/3] w-full object-cover transition-opacity duration-300 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setHeroLoaded(true)}
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-teal-950/70 via-teal-950/10 to-transparent" />
          </div>
          {/* Floating Cards */}
          <div className="absolute -bottom-4 left-2 right-2 flex gap-2 sm:left-4 sm:right-auto sm:w-auto sm:flex-col sm:gap-2">
            <div className="float-animation flex items-center gap-2 rounded-2xl border border-black/5 bg-surface p-3 shadow-xl sm:p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mango-100 text-mango-600"><TrendingUp size={18} /></span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-ink/45">Built for</p>
                <p className="font-display text-sm font-bold text-ink">Filipino businesses</p>
              </div>
            </div>
            <div className="float-animation-delayed flex items-center gap-2 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-white/10 dark:bg-surface/95 sm:p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><ShieldCheck size={18} /></span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-ink/45">Secure</p>
                <p className="font-display text-sm font-bold text-ink">Workflows</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ===== 24/7 ACCESS BANNER ===== */}
    <section className="relative z-10 mx-auto -mt-4 max-w-6xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-r from-teal-950 via-teal-800 to-teal-600 px-5 py-6 text-white shadow-2xl shadow-teal-900/15 sm:px-9 sm:py-8">
        <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-mango-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur sm:h-20 sm:w-20"><Clock3 size={30} className="text-mango-300 sm:text-[34px]" /></span>
            <div><p className="font-display text-4xl font-extrabold tracking-tight text-mango-300 sm:text-5xl">24/7</p><h2 className="font-display text-lg font-bold sm:text-2xl">Business Access</h2></div>
          </div>
          <div className="max-w-md border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0"><p className="text-base font-semibold sm:text-lg">Manage your business anywhere, anytime.</p><p className="mt-1 text-sm leading-6 text-teal-50/65">Access your products, orders, wallet, reports, and business workspace â€” from desktop or mobile.</p></div>
        </div>
      </div>
    </section>

    {content.banners?.some((banner) => banner.visible) && <section className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6">{content.banners.filter((banner) => banner.visible).map((banner) => <div key={banner.id} className={`overflow-hidden p-6 sm:p-8 ${safeImageUrl(banner.image_url) ? 'grid items-center gap-6 md:grid-cols-[1fr_280px]' : ''}`} style={{ background: banner.background, color: banner.text_color, border: `${Math.min(8, Math.max(0, Number(banner.border_width) || 0))}px ${['solid', 'dashed', 'dotted', 'double'].includes(banner.border_style) ? banner.border_style : 'solid'} ${banner.border_color}`, borderRadius: `${Math.min(60, Math.max(0, Number(banner.radius) || 0))}px` }}><div><h2 className="font-display text-2xl font-bold sm:text-3xl">{banner.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">{banner.text}</p>{banner.button_label && <Link to={safeInternalLink(banner.button_link, '/catalog')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">{banner.button_label} <ArrowRight size={15} /></Link>}</div>{safeImageUrl(banner.image_url) && <img src={safeImageUrl(banner.image_url)} alt="" className="aspect-[16/9] w-full rounded-xl object-cover" />}</div>)}</section>}

    {/* ===== TRUSTED PARTNERS ===== */}
    <section className="bg-surface border-y border-black/[0.04] py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">Trusted by the community</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">Partners and collaborators of JOM HUB</h2>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-5 py-3 dark:border-teal-800 dark:bg-teal-500/10">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><Stethoscope size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Partner Clinics</p><p className="text-xs text-ink/40">Dental & Optical</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-mango-200 bg-mango-100/60 px-5 py-3 dark:border-mango-700 dark:bg-mango-500/10">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mango-500 text-ink"><Building2 size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Real Estate Agents</p><p className="text-xs text-ink/40">Properties & Spaces</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-5 py-3 dark:border-teal-800 dark:bg-teal-500/10">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><Truck size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Lalamove</p><p className="text-xs text-ink/40">Delivery Partner</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-5 py-3 dark:border-teal-800 dark:bg-teal-500/10">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><ShieldCheck size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Secure Platform</p><p className="text-xs text-ink/40">Admin-Verified</p></div>
          </div>
        </div>
      </div>
    </section>

    {content.sections?.final_cta !== false && <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20"><div className="relative overflow-hidden rounded-[2rem] bg-teal-900 px-6 py-10 text-center text-white shadow-xl sm:px-12 sm:py-14"><div className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-teal-500/25 blur-3xl" /><div className="relative mx-auto max-w-2xl"><h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to grow your business?</h2><p className="mt-4 text-sm leading-6 text-white/60 sm:text-base">Join JOM HUB as a Merchant or Reseller and manage your marketplace activity in one professional workspace.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-mango-500 px-6 py-3 font-bold text-ink hover:bg-mango-600">Create an account <ArrowRight size={17} /></Link><Link to="/catalog" className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-6 py-3 font-semibold hover:bg-white/15">View products</Link></div></div></div></section>}
    <ScrollNav />
    <JomBits publicMode />
  </div>
}
