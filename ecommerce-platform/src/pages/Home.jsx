import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight, ArrowUp, ArrowDown, BadgeCheck, BarChart3, Building2, Check, CheckCircle2,
  CircleDollarSign, Clock3, FileImage, MessageCircle, PackageCheck,
  ShieldCheck, ShoppingBag,
  Sparkles, Store, TrendingUp, UsersRound, Wallet, X, MailCheck,
  LockKeyhole, Smartphone, Star, Stethoscope, Truck, Handshake, Quote,
  ChevronDown
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import RegistrationCalendar from '../components/registration/RegistrationCalendar'
import { applyCurrentBrand } from '../utils/brand'
import GrowthSection from '../components/home/GrowthSection'
import JomBits from '../components/assistant/JomBits'

const fallback = {
  eyebrow: 'Built for growing Filipino businesses 🇵🇭',
  title: 'Grow your business on a marketplace you can trust.',
  description: 'JOM HUB connects Merchants and Resellers with product sourcing, secure wallet payments, order tracking, business reports, and direct communication — all in one workspace.',
  hero_image: '/hero/filipino-market-vendors.jpg',
  hero_image_mobile: '/hero/filipino-market-vendors.jpg',
  hero_button: 'Start your business', hero_border: 'rounded', hero_accent: '#16794B',
  announcement: { enabled: true, text: 'Welcome to JOM HUB — built for growing Filipino businesses', link_text: 'Join now', link_url: '/signup', background: '#0B4D30', color: '#FFFFFF' },
  banners: [],
  sections: { benefits: true, process: true, subscription: true, topup: true, final_cta: true }
}

const transactionSteps = [
  { icon: ShoppingBag, title: 'Discover', text: 'Browse products from approved Merchants. Compare price, stock, and minimum order quantities.' },
  { icon: Wallet, title: 'Pay securely', text: 'Load your wallet, review the total, and submit payment through a clear, guided process.' },
  { icon: PackageCheck, title: 'Track your order', text: 'Follow every order from confirmation through processing, shipping, and completion.' },
  { icon: ShieldCheck, title: 'Complete with confidence', text: 'Merchant payout is released through a controlled marketplace process once the order is complete.' }
]

const benefits = [
  { icon: Store, title: 'Digital storefront', text: 'Showcase your products, pricing, and business details in a professional online store.' },
  { icon: TrendingUp, title: 'More income', text: 'Connect directly with Resellers looking for reliable products and long-term suppliers.' },
  { icon: BarChart3, title: 'Business reports', text: 'Download sales, inventory, orders, top-ups, and withdrawals as Excel-ready reports.' },
  { icon: MessageCircle, title: 'Fast coordination', text: 'Keep Merchant and Reseller conversations connected to their marketplace activity.' },
  { icon: Wallet, title: 'Organized cash flow', text: 'Track wallet balance, top-ups, withdrawals, fees, payments, and payouts in one place.' },
  { icon: BadgeCheck, title: 'Admin-reviewed access', text: 'Payment proofs and account applications are reviewed for a safer community.' },
  { icon: Sparkles, title: 'Guided setup', text: 'Progress checklists and recommended next actions guide you through every step.' },
  { icon: FileImage, title: 'Printable records', text: 'Keep system-generated receipts for marketplace orders, top-ups, and withdrawals.' },
  { icon: LockKeyhole, title: 'Secure activity history', text: 'Sensitive changes are recorded and available for Admin review.' },
  { icon: Smartphone, title: 'Mobile-friendly workspace', text: 'Resellers and Merchants can move seamlessly between Home, Products, Orders, Wallet, and Account.' },
  { icon: Handshake, title: 'Clinic & real estate referrals', text: 'Refer your customers to partner clinics or real estate agents and earn a referral fee — no upfront cost.' },
  { icon: Truck, title: 'Lalamove integration', text: 'Connect to Lalamove for real-time delivery quotes and faster shipping.' }
]

const featuredHighlights = [
  { title: 'Merchant storefronts', description: 'Launch polished digital stores with pricing, inventory, and secure order handling.', icon: Store },
  { title: 'Reseller growth', description: 'Discover trusted products, manage your cart, and scale with wallet-backed payments.', icon: UsersRound },
  { title: 'Referral income', description: 'Turn partner clinics, real estate agents, and delivery tools into recurring revenue.', icon: Handshake }
]

const categoryCards = [
  { title: 'Merchants', description: 'Open a professional storefront and manage orders with confidence.', icon: Store, href: '/signup' },
  { title: 'Resellers', description: 'Browse, compare, and place orders with transparent pricing.', icon: ShoppingBag, href: '/signup' },
  { title: 'Clinics', description: 'Refer customers and earn commission after confirmed appointments.', icon: Stethoscope, href: '/clinics' },
  { title: 'Real estate', description: 'Connect to property referrals and grow your network.', icon: Building2, href: '/clinics' }
]

const plans = [
  { duration: 'Starter · 6 Months', price: '₱1,599', note: '₱267/month for a new store' },
  { duration: 'Growth · 1 Year', price: '₱2,799', note: '₱233/month — best value', featured: true },
  { duration: 'Pro · 2 Years', price: '₱4,999', note: '₱208/month for the long term' }
]

const faqs = [
  {
    q: 'How do I get started as a Merchant?',
    a: 'Sign up with your Gmail, enter the 6-digit OTP, and choose the "Merchant" role. Complete your business details and you\'ll land in your dashboard right away with a free 6-month subscription, no payment needed to start. Upload a valid business permit — posting products stays locked until Admin approves it, or grants you temporary access on request while it\'s under review. Renew anytime from your dashboard before your free 6 months ends to keep it active.'
  },
  {
    q: 'How do I get started as a Reseller?',
    a: 'Sign up with your Gmail, enter the 6-digit OTP, and choose the "Reseller" role. Complete your contact and delivery address and you\'ll land in your dashboard right away — no wallet top-up required to finish signing up. Verify your identity and top up your wallet whenever you\'re ready; placing orders unlocks once Admin approves both.'
  },
  {
    q: 'How does the Clinic Referral System work?',
    a: 'Go to the clinics page, choose a partner dental or optical clinic and their service, then refer your customer by entering their details. Once the appointment is confirmed by the clinic, the referral fee is automatically transferred to your wallet.'
  },
  {
    q: 'How does Real Estate Referral work?',
    a: 'Browse partner real estate agents and properties on the services page, then refer your customer to the agent. Once a property viewing is scheduled and the transaction is completed, you receive a referral fee — at no upfront cost to you.'
  },
  {
    q: 'What are the payment options?',
    a: 'Use JOM HUB InstaPay QR to top up your wallet. Scan the QR, enter the amount, and upload your payment screenshot along with the one-use reference number. Admin reviews the payment before your wallet is credited.'
  },
  {
    q: 'How does Lalamove delivery work?',
    a: 'Merchants connect their Lalamove account in settings. When a Reseller places an order, they get a real-time delivery quote. Metro Manila and Cebu areas are supported.'
  }
]

const testimonials = [
  { text: 'Finding a reliable supplier used to be so hard. With JOM HUB, it only takes one click — my order gets placed and delivered right away. It saved me so much time and hassle.', name: 'Maria Santos', role: 'Reseller — Bulacan', avatar: 'MS' },
  { text: 'I never expected having a digital storefront to make this much of a difference. My sales grew 40% in the first three months. JOM HUB is easy to use and genuinely professional.', name: 'Juan dela Cruz', role: 'Merchant — Manila', avatar: 'JC' },
  { text: 'I no longer have to collect cash or keep manual records. Orders, payments, reports — everything is automated now. It has been a huge help for my small business.', name: 'Ana Gonzales', role: 'Merchant — Cebu', avatar: 'AG' },
  { text: 'As a reseller, inventory and pricing transparency matter a lot to me. JOM HUB gives me real-time updates from my suppliers. It has been a game changer.', name: 'Carlos Reyes', role: 'Reseller — Laguna', avatar: 'CR' },
  { text: 'The clinic referral system is fantastic. I referred just two customers and received the referral fee straight to my wallet right away — no hassle, no paperwork.', name: 'Diana Lopez', role: 'Reseller — Quezon City', avatar: 'DL' },
  { text: 'I was hesitant at first because I am not very tech-savvy, but the interface is so intuitive that I picked it up right away. Now I use JOM HUB every day for my store.', name: 'Elena Martinez', role: 'Merchant — Davao', avatar: 'EM' }
]

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
  const location = useLocation()
  const { user } = useAuth()
  const [content, setContent] = useState(fallback)
  const [subscriptionPopup, setSubscriptionPopup] = useState(false)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'home').maybeSingle().then(({ data }) => {
      if (data?.value) {
        const value = applyCurrentBrand(data.value)
        setContent({ ...fallback, ...value, announcement: { ...fallback.announcement, ...value.announcement }, sections: { ...fallback.sections, ...value.sections }, banners: value.banners || [] })
      }
    })
  }, [])

  useEffect(() => {
    if (!location.hash) return
    const timer = window.setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => setActiveTestimonial((prev) => (prev + 1) % testimonials.length), 5000)
    return () => clearInterval(interval)
  }, [])

  const closeSubscriptionPopup = () => {
    try { sessionStorage.setItem('rmhub_subscription_popup_seen', 'true') } catch { /* restricted storage */ }
    setSubscriptionPopup(false)
  }

  const heroRadius = content.hero_border === 'square' ? 'rounded-none' : content.hero_border === 'soft' ? 'rounded-xl' : 'rounded-[1.75rem]'

  const [openFaq, setOpenFaq] = useState(null)

  return <div className="overflow-hidden bg-bg">
    {subscriptionPopup && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-scrim/65 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Join JOM HUB">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-surface shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-800 to-teal-600 px-4 py-5 text-white sm:px-7 sm:py-6">
          <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-mango-400/20 blur-2xl" />
          <button type="button" onClick={closeSubscriptionPopup} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white sm:right-4 sm:top-4" aria-label="Close"><X size={19} /></button>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-mango-200"><Sparkles size={14} /> Grow with JOM HUB</span>
          <h2 className="mt-3 max-w-lg pr-6 font-display text-2xl font-extrabold leading-tight sm:text-3xl">Turn your products and connections into a growing business.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-teal-50/75">Join the trusted marketplace built for Filipino Merchants and Resellers — with organized orders, secure workflows, wallets, reports, campaigns, and direct communication.</p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="subscription-audience grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5 dark:border-teal-800 dark:bg-teal-500/10"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-700 text-white"><Store size={21} /></span><h3 className="mt-4 font-display text-lg font-bold text-ink">For Merchants</h3><p className="mt-2 text-sm leading-6 text-ink/60">Build your digital store, reach more Resellers, and manage inventory and orders.</p></div>
            <div className="rounded-2xl border border-mango-300 bg-mango-100/45 p-5 dark:border-mango-700 dark:bg-mango-500/10"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mango-500 text-ink"><UsersRound size={21} /></span><h3 className="mt-4 font-display text-lg font-bold text-ink">For Resellers</h3><p className="mt-2 text-sm leading-6 text-ink/60">Find trusted suppliers, get quantity discounts, and track your sales.</p></div>
          </div>
          <div className="mt-3 rounded-xl border border-black/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700 sm:text-xs">Merchants get 6 months free — renew anytime after with</p><div className="mt-2 grid grid-cols-3 gap-1.5 text-center">{plans.map((plan) => <div key={plan.duration} className={`rounded-lg px-1 py-2 ${plan.featured ? 'bg-teal-700 text-white' : 'bg-surface-inset text-ink'}`}><p className="text-[9px] font-semibold opacity-70 sm:text-[11px]">{plan.duration}</p><p className="mt-0.5 whitespace-nowrap font-display text-sm font-bold sm:text-base">{plan.price}</p></div>)}</div><p className="mt-2 text-center text-[10px] leading-4 text-ink/45 sm:text-xs">No payment needed to activate your free 6-month subscription at signup.</p></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Link to="/signup" onClick={closeSubscriptionPopup} className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 text-sm">Join JOM HUB <ArrowRight size={16} /></Link><button type="button" onClick={closeSubscriptionPopup} className="btn-secondary flex-1 py-2.5 text-sm">Explore the homepage</button></div>
        </div>
      </div>
    </div>}
    {content.announcement?.enabled && <div style={{ background: content.announcement.background, color: content.announcement.color }} className="relative z-20 px-4 py-2.5 text-center text-xs font-semibold sm:text-sm"><span>{content.announcement.text}</span>{content.announcement.link_text && <Link to={safeInternalLink(content.announcement.link_url, '/signup')} className="ml-2 inline-flex items-center gap-1 font-bold underline decoration-white/30 underline-offset-2">{content.announcement.link_text} <ArrowRight size={13} /></Link>}</div>}

    {/* ===== HERO SECTION ===== */}
    <section className="relative">
      <div className="absolute inset-x-0 top-0 -z-0 h-[700px] bg-[radial-gradient(circle_at_80%_15%,rgba(242,169,59,0.18),transparent_28%),radial-gradient(circle_at_10%_15%,rgba(22,121,75,0.14),transparent_28%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-24">
        <div className="order-2 lg:order-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3.5 py-2 text-xs font-bold text-teal-700 shadow-sm backdrop-blur"><Sparkles size={14} className="text-mango-600" /> {content.eyebrow}</span>
          <h1 className="mt-5 max-w-2xl font-display text-[2rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.55rem]">{content.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/65 sm:text-base lg:text-lg">{content.description}</p>
          <div className="mt-4 inline-flex max-w-full items-center gap-3 rounded-2xl border border-teal-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-teal-900/50 dark:bg-black/40">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><MailCheck size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Secure 6-digit email verification</p><p className="text-xs leading-5 text-ink/50">A one-time code sent to your Gmail — no password needed.</p></div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {!user && <Link to="/signup" style={{ backgroundColor: content.hero_accent }} className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white transition hover:opacity-90">{content.hero_button || 'Start your business'} <ArrowRight size={18} /></Link>}
            {user ? <Link to="/catalog" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3.5">Explore products <ShoppingBag size={17} /></Link> : <Link to="/login" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3.5">Sign in to view products <ShoppingBag size={17} /></Link>}
          </div>
          <div className="mt-5 grid max-w-xl grid-cols-1 gap-2 text-sm font-medium text-ink/55 sm:grid-cols-3">
            {['Protected product catalog', 'Curated Reseller stores', 'Mobile-ready access'].map((item) => <span key={item} className="flex items-center gap-1.5"><CheckCircle2 size={16} className="shrink-0 text-teal-500" /> {item}</span>)}
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-2xl lg:max-w-none order-1 lg:order-2">
          <div className="absolute -inset-3 rotate-2 rounded-[2rem] bg-teal-100/80 hidden sm:block" />
          <div className={`relative overflow-hidden ${heroRadius} shadow-2xl shadow-teal-900/20`}>
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
            <div className="flex items-center gap-2 rounded-2xl border border-black/5 bg-surface p-3 shadow-xl sm:p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mango-100 text-mango-600"><TrendingUp size={18} /></span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-ink/45">Built for</p>
                <p className="font-display text-sm font-bold text-ink">Filipino businesses</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-white/10 dark:bg-surface/95 sm:p-4">
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

    <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-10">
      <div className="rounded-[2rem] border border-black/[0.06] bg-white/80 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-surface/80 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">Featured experiences</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">Premium tools for your next growth step.</h2>
          </div>
          <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700">Explore the marketplace <ArrowRight size={16} /></Link>
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

    {/* ===== 24/7 ACCESS BANNER ===== */}
    <section className="relative z-10 mx-auto -mt-4 max-w-6xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-r from-teal-950 via-teal-800 to-teal-600 px-5 py-6 text-white shadow-2xl shadow-teal-900/15 sm:px-9 sm:py-8">
        <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-mango-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur sm:h-20 sm:w-20"><Clock3 size={30} className="text-mango-300 sm:text-[34px]" /></span>
            <div><p className="font-display text-4xl font-extrabold tracking-tight text-mango-300 sm:text-5xl">24/7</p><h2 className="font-display text-lg font-bold sm:text-2xl">Business Access</h2></div>
          </div>
          <div className="max-w-md border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0"><p className="text-base font-semibold sm:text-lg">Manage your business anywhere, anytime.</p><p className="mt-1 text-sm leading-6 text-teal-50/65">Access your products, orders, wallet, reports, and business workspace — from desktop or mobile.</p></div>
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

    {/* ===== TESTIMONIALS ===== */}
    <section className="bg-[linear-gradient(180deg,#EDF7F1_0%,#FFFFFF_48%,#F7FAF7_100%)] py-16 dark:bg-none dark:bg-bg sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">What our community says</p>
          <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-teal-950 dark:text-ink sm:text-3xl">Trusted by Filipino entrepreneurs.</h2>
        </div>
        <div className="mt-10 mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-surface p-6 shadow-xl sm:p-10">
            <Quote size={40} className="absolute right-4 top-4 text-teal-100 sm:right-8 sm:top-8 sm:h-16 sm:w-16" />
            <div className="flex items-center gap-2 mb-4">
              {[0,1,2,3,4].map((star) => <Star key={star} size={16} className="fill-mango-500 text-mango-500" />)}
            </div>
            <p className="text-lg leading-8 text-ink/80 sm:text-xl sm:leading-9 font-medium italic">
              "{testimonials[activeTestimonial].text}"
            </p>
            <div className="mt-6 flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal-600 text-lg font-bold text-white">
                {testimonials[activeTestimonial].avatar}
              </span>
              <div>
                <p className="font-bold text-ink">{testimonials[activeTestimonial].name}</p>
                <p className="text-sm text-ink/50">{testimonials[activeTestimonial].role}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`h-2.5 rounded-full transition-all ${index === activeTestimonial ? 'w-8 bg-teal-600' : 'w-2.5 bg-teal-200'}`}
                  aria-label={`Testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    {content.banners?.some((banner) => banner.visible) && <section className="mx-auto max-w-7xl space-y-4 px-4 pb-8 sm:px-6">{content.banners.filter((banner) => banner.visible).map((banner) => <div key={banner.id} className={`overflow-hidden p-6 sm:p-8 ${safeImageUrl(banner.image_url) ? 'grid items-center gap-6 md:grid-cols-[1fr_280px]' : ''}`} style={{ background: banner.background, color: banner.text_color, border: `${Math.min(8, Math.max(0, Number(banner.border_width) || 0))}px ${['solid', 'dashed', 'dotted', 'double'].includes(banner.border_style) ? banner.border_style : 'solid'} ${banner.border_color}`, borderRadius: `${Math.min(60, Math.max(0, Number(banner.radius) || 0))}px` }}><div><h2 className="font-display text-2xl font-bold sm:text-3xl">{banner.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">{banner.text}</p>{banner.button_label && <Link to={safeInternalLink(banner.button_link, '/catalog')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">{banner.button_label} <ArrowRight size={15} /></Link>}</div>{safeImageUrl(banner.image_url) && <img src={safeImageUrl(banner.image_url)} alt="" className="aspect-[16/9] w-full rounded-xl object-cover" />}</div>)}</section>}

    {/* ===== FAQ ACCORDION ===== */}
    <section className="bg-[linear-gradient(180deg,#FFFFFF_0%,#EDF7F1_100%)] py-16 dark:bg-none dark:bg-bg sm:py-20" id="faq">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">Frequently asked questions</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-teal-950 dark:text-ink sm:text-4xl">Have a question? Here are the answers.</h2>
          <p className="mt-4 text-sm leading-6 text-ink/60">Learn the essentials about JOM HUB — from signing up to earning referral fees.</p>
        </div>
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-black/[0.06] bg-surface shadow-sm transition hover:shadow-md">
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="flex w-full items-center justify-between px-5 py-4 text-left sm:px-6"
                aria-expanded={openFaq === index}
              >
                <span className="pr-4 font-display text-base font-bold text-ink sm:text-lg">{faq.q}</span>
                <ChevronDown
                  size={20}
                  className={`shrink-0 text-teal-600 transition-transform duration-300 ${openFaq === index ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className="border-t border-black/[0.04] px-5 py-4 sm:px-6">
                  <p className="text-sm leading-7 text-ink/65">{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-lg text-center">
          <p className="text-sm text-ink/50">Didn't find your answer? Contact our admin at <a href="mailto:nolascoaubrey32@gmail.com" className="font-semibold text-teal-700 underline">nolascoaubrey32@gmail.com</a></p>
        </div>
      </div>
    </section>

    <GrowthSection />

    <RegistrationCalendar />

    {content.sections?.benefits !== false && <section id="benefits" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Built for real business</p><h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Everything you need to buy, sell, and grow with confidence.</h2><p className="mt-4 text-ink/60">JOM HUB replaces scattered chats, manual records, and disconnected payment tracking — all in one organized workspace.</p></div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{benefits.map(({ icon: Icon, title, text }) => <div key={title} className="group rounded-2xl border border-black/[0.06] bg-surface p-5 shadow-card transition hover:-translate-y-1 hover:border-teal-100 hover:shadow-soft"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-600 group-hover:text-white"><Icon size={19} /></span><h3 className="mt-4 font-display text-base font-bold text-ink sm:text-lg">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/60">{text}</p></div>)}</div>
    </section>}

    {content.sections?.process !== false && <section className="bg-teal-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-mango-300">How JOM HUB works</p><h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">A clearer path from discovery to payment.</h2></div><Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-mango-300">View the marketplace <ArrowRight size={16} /></Link></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{transactionSteps.map(({ icon: Icon, title, text }, index) => <div key={title} className="relative rounded-2xl border border-white/10 bg-white/[0.07] p-5"><span className="absolute right-4 top-4 font-display text-3xl font-bold text-white/[0.08]">0{index + 1}</span><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mango-500 text-ink"><Icon size={21} /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>)}</div>
      </div>
    </section>}

    {content.sections?.subscription !== false && <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" id="subscribe">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700"><Store size={14} /> For Merchants</span><h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">How to subscribe and open your store</h2><p className="mt-4 leading-7 text-ink/60">Create a Merchant profile and you'll land in your dashboard right away with a <strong className="text-ink">free 6-month subscription</strong> — no payment needed to start. Upload your business permit to unlock posting products, or request temporary access while it's under review. Renew anytime before your free 6 months ends to keep your dashboard active.</p>
        <div className="mt-6 space-y-3">{['Enter your Gmail, type the 6-digit OTP, and select Merchant.', 'Complete your business details — your dashboard opens immediately with a free 6-month subscription.', 'Upload a valid business permit to unlock posting products, or request temporary access while it\'s reviewed.', 'Renew before your free 6 months ends so your dashboard stays open.'].map((text, index) => <div key={text} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">{index + 1}</span><p className="pt-0.5 text-sm leading-6 text-ink/65">{text}</p></div>)}</div>
        <Link to="/signup" className="mt-7 inline-flex items-center gap-2 font-semibold text-teal-700">Create a Merchant account <ArrowRight size={17} /></Link></div>
        <div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 text-center dark:border-teal-700 dark:bg-teal-500/10"><p className="font-display text-xl font-bold text-teal-800 dark:text-teal-300">Free for your first 6 months</p><p className="mt-1 text-xs leading-5 text-teal-700/80 dark:text-teal-300/70">Granted automatically at signup — no payment or approval needed to activate it.</p></div>
          <p className="mt-4 text-center text-xs font-semibold uppercase tracking-wider text-ink/40">Renew anytime after with</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">{plans.map((plan) => <div key={plan.duration} className={`relative rounded-2xl border bg-surface p-6 shadow-card ${plan.featured ? 'border-teal-500 ring-4 ring-teal-50' : 'border-black/[0.06]'}`}>{plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Recommended</span>}<p className="text-sm font-semibold text-ink/60">{plan.duration}</p><p className="mt-2 font-display text-3xl font-bold text-ink">{plan.price}</p><p className="mt-2 text-xs leading-5 text-ink/45">{plan.note}</p><div className="mt-5 space-y-2 text-xs text-ink/60"><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Store access</p><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Business reports</p><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Admin review</p></div></div>)}</div>
        </div>
      </div>
    </section>}

    {content.sections?.topup !== false && <section className="border-y border-black/5 bg-surface py-16 sm:py-20" id="topup"><div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center"><div className="rounded-[1.75rem] bg-mango-100/60 p-6 dark:bg-mango-500/10 sm:p-8"><div className="grid gap-3 sm:grid-cols-2">{[{ icon: CircleDollarSign, title: 'Scan and pay', text: 'Use the JOM HUB InstaPay QR to pay AUBREY NOLASCO and enter the amount.' }, { icon: FileImage, title: 'Upload proof', text: 'Upload the screenshot along with the one-use reference number.' }, { icon: Clock3, title: 'Admin verification', text: 'Admin matches the actual payment; duplicate references are blocked.' }, { icon: Wallet, title: 'Wallet credit', text: 'Approved funds appear in your wallet balance.' }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl bg-surface p-5 shadow-sm"><Icon size={20} className="text-mango-600" /><h3 className="mt-3 font-bold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-ink/55">{text}</p></div>)}</div></div>
        <div><span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold text-mango-600"><Wallet size={14} /> For Resellers</span><h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">How Reseller registration works</h2><p className="mt-4 leading-7 text-ink/60">Enter your Gmail, type the 6-digit OTP, select Reseller, and complete your contact and delivery address. You'll land in your dashboard right away — no top-up required to finish signing up.</p><div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50 p-5 dark:border-teal-800 dark:bg-teal-500/10"><p className="font-semibold text-teal-900 dark:text-teal-300">Once you're fully approved</p><p className="mt-1 text-sm leading-6 text-ink/60">Verify your identity and top up your wallet (shown here) whenever you're ready — placing orders and managing customers unlocks once Admin approves both.</p></div><Link to="/signup" className="mt-7 inline-flex items-center gap-2 font-semibold text-teal-700">Register as a Reseller <ArrowRight size={17} /></Link></div>
      </div></section>}

    {content.sections?.final_cta !== false && <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20"><div className="relative overflow-hidden rounded-[2rem] bg-teal-900 px-6 py-10 text-center text-white shadow-xl sm:px-12 sm:py-14"><div className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-teal-500/25 blur-3xl" /><div className="relative mx-auto max-w-2xl"><h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to grow your business?</h2><p className="mt-4 text-sm leading-6 text-white/60 sm:text-base">Join JOM HUB as a Merchant or Reseller and manage your marketplace activity in one professional workspace.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-mango-500 px-6 py-3 font-bold text-ink hover:bg-mango-600">Create an account <ArrowRight size={17} /></Link><Link to="/catalog" className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-6 py-3 font-semibold hover:bg-white/15">View products</Link></div></div></div></section>}
    <ScrollNav />
    <JomBits publicMode />
  </div>
}
