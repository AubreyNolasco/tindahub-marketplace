import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, BarChart3, Check, CheckCircle2,
  CircleDollarSign, Clock3, FileImage, MessageCircle, PackageCheck,
  ShieldCheck, ShoppingBag, Sparkles, Store, TrendingUp, UsersRound,
  Wallet, X, MailCheck, LockKeyhole, Smartphone
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import RegistrationCalendar from '../components/registration/RegistrationCalendar'
import { applyCurrentBrand } from '../utils/brand'
import GrowthSection from '../components/home/GrowthSection'
import JomBits from '../components/assistant/JomBits'

const fallback = {
  eyebrow: 'Built for growing Filipino businesses',
  title: 'Grow your wholesale business in one trusted marketplace.',
  description: 'JOM HUB brings merchants and resellers together with product sourcing, secure wallet payments, order tracking, business reports, and direct communication.',
  hero_image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=85',
  hero_button: 'Start your business', hero_border: 'rounded', hero_accent: '#16794B',
  announcement: { enabled: true, text: 'Welcome to JOM HUB — Built for growing Filipino businesses', link_text: 'Join now', link_url: '/signup', background: '#0B4D30', color: '#FFFFFF' },
  banners: [], sections: { benefits: true, process: true, subscription: true, topup: true, final_cta: true }
}

const transactionSteps = [
  { icon: ShoppingBag, title: 'Discover', text: 'Browse products from approved merchants and compare stock, pricing, and minimum orders.' },
  { icon: Wallet, title: 'Pay securely', text: 'Fund the wallet, review the full order amount, and submit payment through a transparent flow.' },
  { icon: PackageCheck, title: 'Track fulfillment', text: 'Follow every order status from confirmation and processing through shipment and completion.' },
  { icon: ShieldCheck, title: 'Complete safely', text: 'Merchant payouts are released through the controlled marketplace process after completion.' }
]

const benefits = [
  { icon: Store, title: 'A digital storefront', text: 'Show products, prices, inventory, and business information in one professional online store.' },
  { icon: TrendingUp, title: 'More selling opportunities', text: 'Connect directly with resellers looking for reliable products and long-term suppliers.' },
  { icon: BarChart3, title: 'Actionable reports', text: 'Download sales, inventory, orders, top-ups, and withdrawals as Excel-ready reports.' },
  { icon: MessageCircle, title: 'Faster coordination', text: 'Keep merchant and reseller conversations connected to their marketplace activity.' },
  { icon: Wallet, title: 'Organized cash flow', text: 'Track wallet balance, top-ups, withdrawals, fees, payments, and payouts in one place.' },
  { icon: BadgeCheck, title: 'Admin-reviewed access', text: 'Payment proofs and account applications are reviewed to support a more trusted community.' }
]

const plans = [
  { duration: 'Starter · 6 Months', price: '₱1,599', note: '₱267/month for new stores' },
  { duration: 'Growth · 1 Year', price: '₱2,799', note: '₱233/month — best value', featured: true },
  { duration: 'Pro · 2 Years', price: '₱4,999', note: '₱208/month for long-term operations' }
]

const safeInternalLink = (value, fallbackValue) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallbackValue
const safeImageUrl = (value, fallbackValue = '') => typeof value === 'string' && (value.startsWith('/') || value.startsWith('https://')) ? value : fallbackValue

export default function Home() {
  const location = useLocation()
  const { user } = useAuth()
  const [content, setContent] = useState(fallback)
  const [subscriptionPopup, setSubscriptionPopup] = useState(false)
  useEffect(() => { supabase.from('site_settings').select('value').eq('key', 'home').maybeSingle().then(({ data }) => { if (data?.value) { const value = applyCurrentBrand(data.value); setContent({ ...fallback, ...value, announcement: { ...fallback.announcement, ...value.announcement }, sections: { ...fallback.sections, ...value.sections }, banners: value.banners || [] }) } }) }, [])
  useEffect(() => {
    if (!location.hash) return
    const timer = window.setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  const closeSubscriptionPopup = () => {
    try { sessionStorage.setItem('rmhub_subscription_popup_seen', 'true') } catch { /* restricted storage */ }
    setSubscriptionPopup(false)
  }

  const heroRadius = content.hero_border === 'square' ? 'rounded-none' : content.hero_border === 'soft' ? 'rounded-xl' : 'rounded-[1.75rem]'
  return <div className="overflow-hidden bg-cream">
    {subscriptionPopup && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/65 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Join JOM HUB">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-800 to-teal-600 px-4 py-5 text-white sm:px-7 sm:py-6">
          <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-mango-400/20 blur-2xl" />
          <button type="button" onClick={closeSubscriptionPopup} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white sm:right-4 sm:top-4" aria-label="Close"><X size={19} /></button>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-mango-200"><Sparkles size={14} /> Grow with JOM HUB</span>
          <h2 className="mt-3 max-w-lg pr-6 font-display text-2xl font-extrabold leading-tight sm:text-3xl">Turn your products and connections into a growing business.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-teal-50/75">Join a trusted marketplace built for Filipino Merchants and Resellers—with organized orders, secure workflows, wallets, reports, campaigns, and direct in-system communication.</p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="subscription-audience grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-700 text-white"><Store size={21} /></span><h3 className="mt-4 font-display text-lg font-bold text-ink">For Merchants</h3><p className="mt-2 text-sm leading-6 text-ink/60">Build your digital store, reach more resellers, manage inventory and orders, join campaigns, and download business reports.</p></div>
            <div className="rounded-2xl border border-mango-300 bg-mango-100/45 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mango-500 text-ink"><UsersRound size={21} /></span><h3 className="mt-4 font-display text-lg font-bold text-ink">For Resellers</h3><p className="mt-2 text-sm leading-6 text-ink/60">Find trusted suppliers, access quantity discounts, manage customers, place organized orders, and monitor your growing sales activity.</p></div>
          </div>
          <div className="mt-3 rounded-xl border border-black/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700 sm:text-xs">Merchant subscription options</p><div className="mt-2 grid grid-cols-3 gap-1.5 text-center">{plans.map((plan) => <div key={plan.duration} className={`rounded-lg px-1 py-2 ${plan.featured ? 'bg-teal-700 text-white' : 'bg-cream text-ink'}`}><p className="text-[9px] font-semibold opacity-70 sm:text-[11px]">{plan.duration}</p><p className="mt-0.5 whitespace-nowrap font-display text-sm font-bold sm:text-base">{plan.price}</p></div>)}</div><p className="mt-2 text-center text-[10px] leading-4 text-ink/45 sm:text-xs">Submit your payment screenshot and wait for Admin approval before activation.</p></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Link to="/signup" onClick={closeSubscriptionPopup} className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 text-sm">Join JOM HUB today <ArrowRight size={16} /></Link><button type="button" onClick={closeSubscriptionPopup} className="btn-secondary flex-1 py-2.5 text-sm">Explore the homepage</button></div>
        </div>
      </div>
    </div>}
    {content.announcement?.enabled && <div style={{ background: content.announcement.background, color: content.announcement.color }} className="relative z-20 px-4 py-2.5 text-center text-xs font-semibold sm:text-sm"><span>{content.announcement.text}</span>{content.announcement.link_text && <Link to={safeInternalLink(content.announcement.link_url, '/signup')} className="ml-2 inline-flex items-center gap-1 font-bold underline decoration-white/30 underline-offset-2">{content.announcement.link_text} <ArrowRight size={13} /></Link>}</div>}
    <section className="relative">
      <div className="absolute inset-x-0 top-0 -z-0 h-[620px] bg-[radial-gradient(circle_at_80%_15%,rgba(242,169,59,0.18),transparent_28%),radial-gradient(circle_at_10%_15%,rgba(22,121,75,0.14),transparent_28%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_1.02fr] lg:gap-16 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3.5 py-2 text-xs font-bold text-teal-700 shadow-sm backdrop-blur"><Sparkles size={14} className="text-mango-600" /> {content.eyebrow}</span>
          <h1 className="mt-6 max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.55rem]">{content.title}</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink/65 sm:text-lg">{content.description}</p>
          <div className="mt-5 inline-flex max-w-full items-center gap-3 rounded-2xl border border-teal-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><MailCheck size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Secure 6-digit email verification</p><p className="text-xs leading-5 text-ink/50">A one-time code sent to your Gmail protects every account—no password needed.</p></div>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {!user && <Link to="/signup" style={{ backgroundColor: content.hero_accent }} className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white transition hover:opacity-90">{content.hero_button || 'Start your business'} <ArrowRight size={18} /></Link>}
            <Link to="/catalog" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3.5">Explore products <ShoppingBag size={17} /></Link>
          </div>
          <div className="mt-7 grid max-w-xl grid-cols-1 gap-2 text-sm font-medium text-ink/55 sm:grid-cols-3">{['Admin-reviewed accounts', 'Transparent workflows', 'Mobile-ready access'].map((item) => <span key={item} className="flex items-center gap-1.5"><CheckCircle2 size={16} className="shrink-0 text-teal-500" /> {item}</span>)}</div>
        </div>
        <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
          <div className="absolute -inset-3 rotate-2 rounded-[2rem] bg-teal-100/80" />
          <img src={safeImageUrl(content.hero_image, fallback.hero_image)} alt="Business owners using JOM HUB" className={`relative aspect-[4/3] w-full object-cover shadow-2xl shadow-teal-900/20 ${heroRadius}`} />
          <div className="absolute -bottom-5 left-3 flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-xl sm:left-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mango-100 text-mango-600"><TrendingUp size={20} /></span><div><p className="text-xs font-medium text-ink/45">Built to support</p><p className="font-display font-bold text-ink">Business growth</p></div></div>
          <div className="absolute -right-2 top-5 hidden rounded-2xl border border-white/20 bg-teal-900/90 p-4 text-white shadow-xl backdrop-blur sm:block"><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={18} className="text-mango-300" /> Secure workflows</p><p className="mt-1 text-xs text-white/55">From signup to payout</p></div>
        </div>
      </div>
    </section>

    <section className="relative z-10 mx-auto -mt-4 max-w-6xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-r from-teal-950 via-teal-800 to-teal-600 px-6 py-7 text-white shadow-2xl shadow-teal-900/15 sm:px-9 sm:py-8">
        <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-mango-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-teal-300/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur sm:h-20 sm:w-20"><Clock3 size={34} className="text-mango-300" /></span>
            <div><p className="font-display text-4xl font-extrabold tracking-tight text-mango-300 sm:text-5xl">24/7</p><h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">Business Access</h2></div>
          </div>
          <div className="max-w-md border-t border-white/10 pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0"><p className="text-lg font-semibold">Manage anywhere, anytime.</p><p className="mt-1.5 text-sm leading-6 text-teal-50/65">Access your products, orders, wallet, reports, and business workspace whenever you need them—from desktop or mobile.</p></div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="email-security-title">
      <div className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-white shadow-2xl shadow-teal-900/[0.08]">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-mango-200/50 blur-3xl" />
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative p-6 sm:p-10 lg:p-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-teal-700"><ShieldCheck size={15} /> Account protection</span>
            <h2 id="email-security-title" className="mt-5 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">Register and sign in using a secure code from your Gmail.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-ink/60 sm:text-base">Enter your email, check your inbox for the JOM HUB message, then type the 6-digit OTP on the website. There is no password to remember, and the code expires after 10 minutes.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[{ icon: MailCheck, title: '1. Enter your email', text: 'Use the Gmail address you want connected to your JOM HUB account.' }, { icon: LockKeyhole, title: '2. Type the OTP', text: 'Open the JOM HUB email and enter its 6-digit verification code.' }, { icon: Clock3, title: '3. Complete registration', text: 'Choose Merchant or Reseller and submit the required account details.' }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-black/[0.06] bg-cream/70 p-4"><Icon size={20} className="text-teal-700" /><h3 className="mt-3 text-sm font-bold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-ink/50">{text}</p></div>)}
            </div>
          </div>
          <div className="relative flex min-h-[330px] items-center justify-center overflow-hidden bg-gradient-to-br from-teal-950 via-teal-800 to-teal-600 p-6 sm:p-10">
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative w-full max-w-sm rounded-[1.75rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md sm:p-6">
              <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mango-400 text-ink"><MailCheck size={22} /></span><div><p className="text-xs text-white/55">JOM HUB SECURITY</p><p className="font-bold text-white">Check your inbox</p></div></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" /></div>
              <div className="mt-6 rounded-2xl bg-white p-5"><p className="text-xs font-semibold text-teal-700">Your JOM HUB verification code</p><p className="mt-3 text-center font-display text-3xl font-extrabold tracking-[0.3em] text-teal-800">••••••</p><p className="mt-3 text-sm leading-6 text-ink/55">Copy the 6-digit code from Gmail and enter it only on the official JOM HUB login page.</p><span className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white">Send verification code <ArrowRight size={16} /></span></div>
              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-white/60"><Smartphone size={14} /> Works securely on mobile and desktop</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    {content.banners?.some((banner) => banner.visible) && <section className="mx-auto max-w-7xl space-y-4 px-4 pb-8 sm:px-6">{content.banners.filter((banner) => banner.visible).map((banner) => <div key={banner.id} className={`overflow-hidden p-6 sm:p-8 ${safeImageUrl(banner.image_url) ? 'grid items-center gap-6 md:grid-cols-[1fr_280px]' : ''}`} style={{ background: banner.background, color: banner.text_color, border: `${Math.min(8, Math.max(0, Number(banner.border_width) || 0))}px ${['solid', 'dashed', 'dotted', 'double'].includes(banner.border_style) ? banner.border_style : 'solid'} ${banner.border_color}`, borderRadius: `${Math.min(60, Math.max(0, Number(banner.radius) || 0))}px` }}><div><h2 className="font-display text-2xl font-bold sm:text-3xl">{banner.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">{banner.text}</p>{banner.button_label && <Link to={safeInternalLink(banner.button_link, '/catalog')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">{banner.button_label} <ArrowRight size={15} /></Link>}</div>{safeImageUrl(banner.image_url) && <img src={safeImageUrl(banner.image_url)} alt="" className="aspect-[16/9] w-full rounded-xl object-cover" />}</div>)}</section>}

    <GrowthSection />

    <RegistrationCalendar />

    {content.sections?.benefits !== false && <section id="benefits" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Made for real business operations</p><h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Everything you need to buy, sell, and operate with confidence.</h2><p className="mt-4 text-ink/60">JOM HUB replaces scattered chats, manual records, and disconnected payment tracking with one organized workspace.</p></div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{benefits.map(({ icon: Icon, title, text }) => <div key={title} className="group rounded-2xl border border-black/[0.06] bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-teal-100 hover:shadow-soft"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-600 group-hover:text-white"><Icon size={21} /></span><h3 className="mt-5 font-display text-lg font-bold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/60">{text}</p></div>)}</div>
    </section>}

    {content.sections?.process !== false && <section className="bg-teal-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-mango-300">How JOM HUB works</p><h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">A clearer path from product discovery to payout.</h2></div><Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-mango-300">View marketplace <ArrowRight size={16} /></Link></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{transactionSteps.map(({ icon: Icon, title, text }, index) => <div key={title} className="relative rounded-2xl border border-white/10 bg-white/[0.07] p-5"><span className="absolute right-4 top-4 font-display text-3xl font-bold text-white/[0.08]">0{index + 1}</span><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mango-500 text-ink"><Icon size={21} /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>)}</div>
      </div>
    </section>}

    {content.sections?.subscription !== false && <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" id="subscribe">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700"><Store size={14} /> For Merchants</span><h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">How to subscribe and open your store</h2><p className="mt-4 leading-7 text-ink/60">Create a Merchant profile, choose a subscription, and submit a screenshot of your payment. The Admin reviews the application before activating your store.</p>
        <div className="mt-6 space-y-3">{['Enter your Gmail, type the 6-digit OTP, then choose Merchant.', 'Complete your business details and submit a valid business permit.', 'Choose 6 months, 1 year, or 2 years and upload your payment proof.', 'Wait for Admin approval, then manage your products and orders.'].map((text, index) => <div key={text} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">{index + 1}</span><p className="pt-0.5 text-sm leading-6 text-ink/65">{text}</p></div>)}</div>
        <Link to="/signup" className="mt-7 inline-flex items-center gap-2 font-semibold text-teal-700">Create a Merchant account <ArrowRight size={17} /></Link></div>
        <div className="grid gap-4 sm:grid-cols-3">{plans.map((plan) => <div key={plan.duration} className={`relative rounded-2xl border bg-white p-6 shadow-card ${plan.featured ? 'border-teal-500 ring-4 ring-teal-50' : 'border-black/[0.06]'}`}>{plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Recommended</span>}<p className="text-sm font-semibold text-ink/60">{plan.duration}</p><p className="mt-2 font-display text-3xl font-bold text-ink">{plan.price}</p><p className="mt-2 text-xs leading-5 text-ink/45">{plan.note}</p><div className="mt-5 space-y-2 text-xs text-ink/60"><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Store access</p><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Business reports</p><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Admin review</p></div></div>)}</div>
      </div>
    </section>}

    {content.sections?.topup !== false && <section className="border-y border-black/5 bg-white py-16 sm:py-20" id="topup"><div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center"><div className="rounded-[1.75rem] bg-mango-100/60 p-6 sm:p-8"><div className="grid gap-3 sm:grid-cols-2">{[{ icon: CircleDollarSign, title: 'Scan and pay', text: 'Use the JOM HUB InstaPay QR for AUBREY NOLASCO and enter the amount.' }, { icon: FileImage, title: 'Submit secure proof', text: 'Upload the screenshot and its one-use reference number.' }, { icon: Clock3, title: 'Admin verification', text: 'Admin matches the real payment; duplicate references are blocked.' }, { icon: Wallet, title: 'Wallet credit', text: 'Approved funds appear once in the wallet balance.' }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl bg-white p-5 shadow-sm"><Icon size={20} className="text-mango-600" /><h3 className="mt-3 font-bold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-ink/55">{text}</p></div>)}</div></div>
        <div><span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold text-mango-600"><Wallet size={14} /> For Resellers</span><h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">How Reseller registration works</h2><p className="mt-4 leading-7 text-ink/60">Enter your Gmail, type the 6-digit OTP, choose Reseller, then complete your contact and delivery address. Submit the required initial top-up proof for Admin verification and account approval.</p><div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50 p-5"><p className="font-semibold text-teal-900">After account approval</p><p className="mt-1 text-sm leading-6 text-ink/60">Browse approved products, manage customers and orders, and use Wallet for future top-ups. Every top-up remains subject to Admin verification.</p></div><Link to="/signup" className="mt-7 inline-flex items-center gap-2 font-semibold text-teal-700">Register as a Reseller <ArrowRight size={17} /></Link></div>
      </div></section>}

    {content.sections?.final_cta !== false && <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20"><div className="relative overflow-hidden rounded-[2rem] bg-teal-900 px-6 py-10 text-center text-white shadow-xl sm:px-12 sm:py-14"><div className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-teal-500/25 blur-3xl" /><div className="relative mx-auto max-w-2xl"><h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to build a more organized business?</h2><p className="mt-4 text-sm leading-6 text-white/60 sm:text-base">Join JOM HUB as a Merchant or Reseller and manage your marketplace activity in one professional workspace.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-mango-500 px-6 py-3 font-bold text-ink hover:bg-mango-600">Create an account <ArrowRight size={17} /></Link><Link to="/catalog" className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-6 py-3 font-semibold hover:bg-white/15">Browse products</Link></div></div></div></section>}
    <JomBits publicMode />
  </div>
}
