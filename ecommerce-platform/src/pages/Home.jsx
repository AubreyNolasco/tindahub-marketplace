import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, BarChart3, Building2, Check, CheckCircle2,
  CircleDollarSign, Clock3, FileImage, HelpCircle, Key,
  MessageCircle, PackageCheck, Phone, ShieldCheck, ShoppingBag,
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
  eyebrow: 'Para sa lumalagong negosyong Pilipino 🇵🇭',
  title: 'Palaguin ang iyong negosyo sa isang pinagkakatiwalaang merkado.',
  description: 'Pinagsasama ng JOM HUB ang mga merchant at reseller — may produktong sourcing, secure wallet payments, order tracking, business reports, at direktang komunikasyon.',
  hero_image: 'https://images.unsplash.com/photo-1607748862156-7c548e5e5cfd?auto=format&fit=crop&w=1400&q=85',
  hero_image_mobile: 'https://images.unsplash.com/photo-1607748862156-7c548e5e5cfd?auto=format&fit=crop&w=600&q=70',
  hero_button: 'Simulan ang iyong negosyo', hero_border: 'rounded', hero_accent: '#16794B',
  announcement: { enabled: true, text: 'Maligayang pagdating sa JOM HUB — Itinayo para sa lumalagong negosyong Pilipino', link_text: 'Sumali na', link_url: '/signup', background: '#0B4D30', color: '#FFFFFF' },
  banners: [],
  sections: { benefits: true, process: true, subscription: true, topup: true, final_cta: true }
}

const transactionSteps = [
  { icon: ShoppingBag, title: 'Tuklasin', text: 'Maghanap ng produkto mula sa mga aprubadong merchant. Ihambing ang presyo, stock, at minimum order.' },
  { icon: Wallet, title: 'Magbayad nang ligtas', text: 'I-load ang wallet, suriin ang kabuuang halaga, at magsumite ng payment sa malinaw na proseso.' },
  { icon: PackageCheck, title: 'Subaybayan ang order', text: 'Sundan ang bawat order — mula kumpirmasyon hanggang sa pagproseso, pagpapadala, at pagkumpleto.' },
  { icon: ShieldCheck, title: 'Kumpletuhin nang ligtas', text: 'Ang bayad sa merchant ay ilalabas sa pamamagitan ng kontroladong proseso ng marketplace pagkatapos makumpleto.' }
]

const benefits = [
  { icon: Store, title: 'Digital na tindahan', text: 'Ipakita ang iyong produkto, presyo, at impormasyon ng negosyo sa isang propesyonal na online store.' },
  { icon: TrendingUp, title: 'Dagdag kita', text: 'Direktang kumonekta sa mga reseller na naghahanap ng maaasahang produkto at pangmatagalang supplier.' },
  { icon: BarChart3, title: 'Mga ulat ng negosyo', text: 'I-download ang sales, inventory, orders, top-ups, at withdrawals bilang Excel-ready reports.' },
  { icon: MessageCircle, title: 'Mabilis na koordinasyon', text: 'Panatilihing konektado ang usapan ng merchant at reseller sa kanilang marketplace activity.' },
  { icon: Wallet, title: 'Organisadong cash flow', text: 'Subaybayan ang wallet balance, top-ups, withdrawals, fees, payments, at payouts sa isang lugar.' },
  { icon: BadgeCheck, title: 'Admin-reviewed access', text: 'Ang mga payment proofs at account applications ay sinusuri para sa mas ligtas na komunidad.' },
  { icon: Sparkles, title: 'Gabay sa pag-setup', text: 'Ang progress checklists at recommended next actions ay gagabay sa iyo sa bawat hakbang.' },
  { icon: FileImage, title: 'Mga printable records', text: 'Panatilihin ang system-generated receipts para sa marketplace orders, top-ups, at withdrawals.' },
  { icon: LockKeyhole, title: 'Ligtas na activity history', text: 'Ang mga sensitibong pagbabago ay recorded para sa Admin review.' },
  { icon: Smartphone, title: 'Mobile-friendly workspace', text: 'Ang mga Reseller at Merchant ay makakagalaw sa pagitan ng Home, Products, Orders, Wallet, at Account.' },
  { icon: Stethoscope, title: 'Clinic & Real Estate referrals', text: 'I-refer ang iyong customer sa partner clinics o real estate agents at kumita ng referral fee — walang upfront cost.' },
  { icon: Truck, title: 'Lalamove integration', text: 'Kumonekta sa Lalamove para sa real-time delivery quotes at mas mabilis na pagpapadala.' }
]

const plans = [
  { duration: 'Starter · 6 Months', price: '₱1,599', note: '₱267/month para sa bagong store' },
  { duration: 'Growth · 1 Year', price: '₱2,799', note: '₱233/month — best value', featured: true },
  { duration: 'Pro · 2 Years', price: '₱4,999', note: '₱208/month para sa pangmatagalan' }
]

const faqs = [
  {
    q: 'Paano ako mag-start bilang Merchant?',
    a: 'Gumamit ng iyong Gmail para mag-sign up, i-type ang 6-digit OTP, at piliin ang "Merchant" role. Kumpletuhin ang iyong business details, mag-upload ng valid business permit, pumili ng subscription plan (6 months, 1 year, o 2 years), at mag-upload ng payment proof. Maghintay ng Admin approval para i-activate ang iyong store.'
  },
  {
    q: 'Paano ako mag-start bilang Reseller?',
    a: 'Gumamit ng iyong Gmail para mag-sign up, i-type ang 6-digit OTP, at piliin ang "Reseller" role. Kumpletuhin ang iyong contact at delivery address, mag-submit ng initial wallet top-up proof, at maghintay ng Admin verification. Pagkatapos ma-approve, makakapag-browse ka na ng mga produkto at makakapag-order.'
  },
  {
    q: 'Paano gumagana ang Clinic Referral System?',
    a: 'Pumunta sa clinics page, pumili ng partner dental o optical clinic at ng kanilang service. I-refer ang iyong customer sa pamamagitan ng pag-enter ng kanilang details. Pagkatapos ng appointment, iko-confirm ng clinic at awtomatikong ililipat ang referral fee sa iyong wallet.'
  },
  {
    q: 'Paano gumagana ang Real Estate Referral?',
    a: 'Mag-browse ng partner real estate agents at properties sa services page. I-refer ang iyong customer sa agent. Kapag nag-schedule ng property viewing at kumpletuhin ang transaction, makakatanggap ka ng referral fee — walang upfront cost sa iyo.'
  },
  {
    q: 'Ano ang mga payment options?',
    a: 'Gamitin ang JOM HUB InstaPay QR para mag-top up ng iyong wallet. I-scan ang QR, ilagay ang amount, at i-upload ang payment screenshot kasama ang one-use reference number. Susuriin ng Admin ang payment bago ma-credit ang iyong wallet.'
  },
  {
    q: 'Paano gumagana ang Lalamove delivery?',
    a: 'Ikonekta ng Merchant ang kanilang Lalamove account sa settings. Kapag nag-order ang Reseller, makakakuha sila ng real-time delivery quote. Suportado ang Metro Manila at Cebu areas.'
  }
]

const testimonials = [
  { text: 'Dati, ang hirap maghanap ng maaasahang supplier. Sa JOM HUB, isang click lang — naka-order na ako at nadeliver agad. Malaki ang natipid ko sa oras at pahirap sa paghahanap.', name: 'Maria Santos', role: 'Reseller — Bulacan', avatar: 'MS' },
  { text: 'Ang saya pala ng may digital storefront. Lumaki ang benta ko nang 40% sa unang tatlong buwan. Sobrang dali gamitin at napaka-professional ng JOM HUB.', name: 'Juan dela Cruz', role: 'Merchant — Manila', avatar: 'JC' },
  { text: 'Hindi ko na kailangan mangolekta ng cash o magmanual ng records. Lahat — orders, payments, reports — automated na. Laking tulong para sa maliit kong negosyo.', name: 'Ana Gonzales', role: 'Merchant — Cebu', avatar: 'AG' },
  { text: 'As a reseller, mahalaga sa akin ang inventory at pricing transparency. JOM HUB gives me real-time updates from my suppliers. Game changer siya!', name: 'Carlos Reyes', role: 'Reseller — Laguna', avatar: 'CR' },
  { text: 'Ang galing ng clinic referral system! Nag-refer lang ako ng dalawang customer, nakatanggap agad ng referral fee sa wallet ko. Walang hassle, walang papel.', name: 'Diana Lopez', role: 'Reseller — Quezon City', avatar: 'DL' },
  { text: 'Una akong nag-alinlangan dahil hindi ako tech-savvy. Pero ang intuitive ng interface — natuto ako agad. Ngayon, araw-araw ko ginagamit ang JOM HUB para sa aking store.', name: 'Elena Martinez', role: 'Merchant — Davao', avatar: 'EM' }
]

const safeInternalLink = (value, fallbackValue) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallbackValue
const safeImageUrl = (value, fallbackValue = '') => typeof value === 'string' && (value.startsWith('/') || value.startsWith('https://')) ? value : fallbackValue

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

  return <div className="overflow-hidden bg-cream">
    {subscriptionPopup && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/65 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Join JOM HUB">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-800 to-teal-600 px-4 py-5 text-white sm:px-7 sm:py-6">
          <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-mango-400/20 blur-2xl" />
          <button type="button" onClick={closeSubscriptionPopup} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white sm:right-4 sm:top-4" aria-label="Close"><X size={19} /></button>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-mango-200"><Sparkles size={14} /> Lumago kasama ang JOM HUB</span>
          <h2 className="mt-3 max-w-lg pr-6 font-display text-2xl font-extrabold leading-tight sm:text-3xl">Gawing lumalagong negosyo ang iyong produkto at koneksyon.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-teal-50/75">Sumali sa pinagkakatiwalaang marketplace na ginawa para sa mga Pilipinong Merchant at Reseller — may organized orders, secure workflows, wallets, reports, campaigns, at direct communication.</p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="subscription-audience grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-700 text-white"><Store size={21} /></span><h3 className="mt-4 font-display text-lg font-bold text-ink">Para sa Merchants</h3><p className="mt-2 text-sm leading-6 text-ink/60">Buuin ang iyong digital store, maabot ang mas maraming reseller, at pamahalaan ang inventory at orders.</p></div>
            <div className="rounded-2xl border border-mango-300 bg-mango-100/45 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mango-500 text-ink"><UsersRound size={21} /></span><h3 className="mt-4 font-display text-lg font-bold text-ink">Para sa Resellers</h3><p className="mt-2 text-sm leading-6 text-ink/60">Maghanap ng pinagkakatiwalaang supplier, magkaroon ng quantity discounts, at subaybayan ang iyong benta.</p></div>
          </div>
          <div className="mt-3 rounded-xl border border-black/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700 sm:text-xs">Merchant subscription options</p><div className="mt-2 grid grid-cols-3 gap-1.5 text-center">{plans.map((plan) => <div key={plan.duration} className={`rounded-lg px-1 py-2 ${plan.featured ? 'bg-teal-700 text-white' : 'bg-cream text-ink'}`}><p className="text-[9px] font-semibold opacity-70 sm:text-[11px]">{plan.duration}</p><p className="mt-0.5 whitespace-nowrap font-display text-sm font-bold sm:text-base">{plan.price}</p></div>)}</div><p className="mt-2 text-center text-[10px] leading-4 text-ink/45 sm:text-xs">I-submit ang iyong payment screenshot at maghintay ng Admin approval.</p></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Link to="/signup" onClick={closeSubscriptionPopup} className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 text-sm">Sumali sa JOM HUB <ArrowRight size={16} /></Link><button type="button" onClick={closeSubscriptionPopup} className="btn-secondary flex-1 py-2.5 text-sm">I-explore ang homepage</button></div>
        </div>
      </div>
    </div>}
    {content.announcement?.enabled && <div style={{ background: content.announcement.background, color: content.announcement.color }} className="relative z-20 px-4 py-2.5 text-center text-xs font-semibold sm:text-sm"><span>{content.announcement.text}</span>{content.announcement.link_text && <Link to={safeInternalLink(content.announcement.link_url, '/signup')} className="ml-2 inline-flex items-center gap-1 font-bold underline decoration-white/30 underline-offset-2">{content.announcement.link_text} <ArrowRight size={13} /></Link>}</div>}

    {/* ===== HERO SECTION - REDESIGNED WITH FILIPINO MODELS ===== */}
    <section className="relative">
      <div className="absolute inset-x-0 top-0 -z-0 h-[700px] bg-[radial-gradient(circle_at_80%_15%,rgba(242,169,59,0.18),transparent_28%),radial-gradient(circle_at_10%_15%,rgba(22,121,75,0.14),transparent_28%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-24">
        <div className="order-2 lg:order-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3.5 py-2 text-xs font-bold text-teal-700 shadow-sm backdrop-blur"><Sparkles size={14} className="text-mango-600" /> {content.eyebrow}</span>
          <h1 className="mt-5 max-w-2xl font-display text-[2rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.55rem]">{content.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/65 sm:text-base lg:text-lg">{content.description}</p>
          <div className="mt-4 inline-flex max-w-full items-center gap-3 rounded-2xl border border-teal-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><MailCheck size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Secure 6-digit email verification</p><p className="text-xs leading-5 text-ink/50">Isang one-time code na ipinadala sa iyong Gmail — walang password na kailangan.</p></div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {!user && <Link to="/signup" style={{ backgroundColor: content.hero_accent }} className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white transition hover:opacity-90">{content.hero_button || 'Simulan ang negosyo'} <ArrowRight size={18} /></Link>}
            {user ? <Link to="/catalog" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3.5">I-explore ang mga produkto <ShoppingBag size={17} /></Link> : <Link to="/login" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3.5">Mag-sign in para sa mga produkto <ShoppingBag size={17} /></Link>}
          </div>
          <div className="mt-5 grid max-w-xl grid-cols-1 gap-2 text-sm font-medium text-ink/55 sm:grid-cols-3">
            {['Protected product catalog', 'Curated Reseller stores', 'Mobile-ready access'].map((item) => <span key={item} className="flex items-center gap-1.5"><CheckCircle2 size={16} className="shrink-0 text-teal-500" /> {item}</span>)}
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-2xl lg:max-w-none order-1 lg:order-2">
          <div className="absolute -inset-3 rotate-2 rounded-[2rem] bg-teal-100/80 hidden sm:block" />
          <div className="relative overflow-hidden rounded-[1.75rem] shadow-2xl shadow-teal-900/20">
            <picture>
              <source media="(min-width: 1024px)" srcSet="https://images.unsplash.com/photo-1607748862156-7c548e5e5cfd?auto=format&fit=crop&w=1400&q=85" />
              <source media="(min-width: 640px)" srcSet="https://images.unsplash.com/photo-1607748862156-7c548e5e5cfd?auto=format&fit=crop&w=800&q=80" />
              <img
                src="https://images.unsplash.com/photo-1607748862156-7c548e5e5cfd?auto=format&fit=crop&w=600&q=70"
                alt="Filipina entrepreneur managing her online business"
                className={`aspect-[4/3] w-full object-cover transition-opacity duration-300 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setHeroLoaded(true)}
                loading="eager"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
          {/* Floating Cards */}
          <div className="absolute -bottom-4 left-2 right-2 flex gap-2 sm:left-4 sm:right-auto sm:w-auto sm:flex-col sm:gap-0">
            <div className="flex items-center gap-2 rounded-2xl border border-black/5 bg-white p-3 shadow-xl sm:p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mango-100 text-mango-600"><TrendingUp size={18} /></span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-ink/45">Para sa</p>
                <p className="font-display text-sm font-bold text-ink">Pilipinong negosyo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-xl backdrop-blur sm:p-4">
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
          <div className="max-w-md border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0"><p className="text-base font-semibold sm:text-lg">Pamahalaan kahit saan, kahit kailan.</p><p className="mt-1 text-sm leading-6 text-teal-50/65">Ma-access ang iyong products, orders, wallet, reports, at business workspace — mula sa desktop o mobile.</p></div>
        </div>
      </div>
    </section>

    {/* ===== CLINIC REFERRAL PATH ===== */}
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] rounded-[2rem] border border-teal-100 bg-white shadow-2xl shadow-teal-900/[0.06] overflow-hidden">
        <div className="relative p-6 sm:p-10 lg:p-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-mango-700"><Stethoscope size={15} /> Clinic Referral System</span>
          <h2 className="mt-5 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">Kumita sa pagre-refer ng customer sa clinic.</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/60 sm:text-base">I-refer ang iyong customer sa partner dental o optical clinic at kumita ng referral fee. <strong>Walang upfront cost</strong> — ang clinic ang magbabayad pagkatapos ng appointment.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4"><Stethoscope size={20} className="text-teal-700" /><h3 className="mt-3 text-sm font-bold text-ink">Dental & Optical Clinics</h3><p className="mt-1 text-xs leading-5 text-ink/50">Partner clinics na nag-aalok ng dental cleaning, eye checkup, at iba pa.</p></div>
            <div className="rounded-2xl border border-mango-200 bg-mango-100/60 p-4"><TrendingUp size={20} className="text-mango-700" /><h3 className="mt-3 text-sm font-bold text-ink">Referral Fee</h3><p className="mt-1 text-xs leading-5 text-ink/50">Kumita ng referral fee na awtomatikong ililipad sa iyong wallet.</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/clinics" className="btn-accent inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold">Tingnan ang mga clinic <ArrowRight size={16} /></Link>
            <Link to="/signup" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">Mag-sign up bilang Reseller</Link>
          </div>
        </div>
        <div className="flex min-h-[280px] items-center justify-center bg-gradient-to-br from-mango-400 to-mango-600 p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <div className="rounded-[1.75rem] border border-white/20 bg-white/15 p-5 shadow-2xl backdrop-blur-md text-ink">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-mango-600"><Stethoscope size={24} /></span>
                <div><p className="text-xs text-white/70">CLINIC REFERRAL</p><p className="font-bold text-white">Kumita ng referral fee</p></div>
              </div>
              <div className="mt-5 grid gap-3">
                <div className="flex items-center gap-3 rounded-xl bg-white/90 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700 text-xs font-bold">1</span><p className="text-xs font-semibold text-ink">Pumili ng clinic service</p></div>
                <div className="flex items-center gap-3 rounded-xl bg-white/90 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700 text-xs font-bold">2</span><p className="text-xs font-semibold text-ink">I-refer ang iyong customer</p></div>
                <div className="flex items-center gap-3 rounded-xl bg-white/90 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700 text-xs font-bold">3</span><p className="text-xs font-semibold text-ink">Kumita pagkatapos ng appointment</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ===== LALAMOVE INTEGRATION ===== */}
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-gradient-to-br from-teal-50 to-white shadow-2xl shadow-teal-900/[0.06]">
        <div className="grid lg:grid-cols-[1fr_1fr]">
          <div className="flex min-h-[250px] items-center justify-center bg-gradient-to-br from-teal-700 to-teal-950 p-6 sm:p-10">
            <div className="w-full max-w-sm">
              <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-teal-700"><Truck size={24} /></span>
                  <div><p className="text-xs text-white/70">LALAMOVE</p><p className="font-bold text-white">Real-time delivery</p></div>
                </div>
                <div className="mt-4 rounded-xl bg-white/20 p-4 text-center">
                  <p className="text-3xl font-bold text-white">🚚</p>
                  <p className="mt-2 text-sm font-semibold text-white">Metro Manila · Cebu</p>
                </div>
                <p className="mt-3 text-xs text-white/60 text-center">Ikonekta ang iyong Lalamove API key para sa instant delivery quotes.</p>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-10 lg:p-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-teal-700"><Truck size={15} /> Lalamove Integration</span>
            <h2 className="mt-5 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">Mabilis na pagpapadala gamit ang Lalamove.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-ink/60 sm:text-base">Ikonekta ang iyong Lalamove account para makakuha ng real-time delivery quotes. Ang mga reseller ay maaring mag-opt-in para sa mas mabilis na pagpapadala.</p>
            <div className="mt-6 grid gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-white p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Real-time delivery pricing mula sa Lalamove API</p></div>
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-white p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Suportado ang Metro Manila at Cebu</p></div>
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-white p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Ikonekta ang inyong sariling Lalamove account</p></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/reseller/delivery" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">I-set up ang Lalamove <ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ===== REAL ESTATE REFERRAL ===== */}
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-gradient-to-br from-teal-50 to-white shadow-2xl shadow-teal-900/[0.06]">
        <div className="grid lg:grid-cols-[1fr_1fr]">
          <div className="flex min-h-[250px] items-center justify-center bg-gradient-to-br from-mango-500 to-mango-600 p-6 sm:p-10">
            <div className="w-full max-w-sm">
              <div className="rounded-[1.75rem] border border-white/20 bg-white/15 p-5 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-mango-600"><Building2 size={24} /></span>
                  <div><p className="text-xs text-white/70">REAL ESTATE</p><p className="font-bold text-white">Property referral fees</p></div>
                </div>
                <div className="mt-4 rounded-xl bg-white/20 p-4 text-center">
                  <p className="text-3xl font-bold text-white">🏠</p>
                  <p className="mt-2 text-sm font-semibold text-white">Condos · Houses · Lots</p>
                </div>
                <p className="mt-3 text-xs text-white/60 text-center">I-refer ang iyong customer sa partner real estate agents at kumita ng referral fee.</p>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-10 lg:p-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-mango-700"><Building2 size={15} /> Real Estate Referral</span>
            <h2 className="mt-5 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">Kumita sa pagre-refer ng property buyer.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-ink/60 sm:text-base">I-refer ang iyong customer sa partner real estate agents para sa condo, house and lot, o commercial property. <strong>Walang upfront cost</strong> — kumita ng referral fee pagkatapos ng successful transaction.</p>
            <div className="mt-6 grid gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-white p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Partner real estate agents na may verified properties</p></div>
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-white p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Condos, houses, lots, at commercial spaces</p></div>
              <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-white p-4"><Check size={18} className="shrink-0 text-teal-600" /><p className="text-sm text-ink/70">Awtomatikong referral fee sa iyong wallet</p></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/clinics" className="btn-accent inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold">Tingnan ang mga properties <ArrowRight size={16} /></Link>
              <Link to="/signup" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">Mag-sign up bilang Reseller</Link>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ===== TRUSTED PARTNERS ===== */}
    <section className="bg-white border-y border-black/[0.04] py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">Pinagkakatiwalaan ng komunidad</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">Mga kasosyo at partner ng JOM HUB</h2>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-5 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><Stethoscope size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Partner Clinics</p><p className="text-xs text-ink/40">Dental & Optical</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-mango-200 bg-mango-100/60 px-5 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mango-500 text-ink"><Building2 size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Real Estate Agents</p><p className="text-xs text-ink/40">Properties & Spaces</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-5 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><Truck size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Lalamove</p><p className="text-xs text-ink/40">Delivery Partner</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-5 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><ShieldCheck size={20} /></span>
            <div><p className="text-sm font-bold text-ink">Secure Platform</p><p className="text-xs text-ink/40">Admin-Verified</p></div>
          </div>
        </div>
      </div>
    </section>

    {/* ===== TESTIMONIALS ===== */}
    <section className="bg-[linear-gradient(180deg,#EDF7F1_0%,#FFFFFF_48%,#F7FAF7_100%)] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">Sinabi ng aming komunidad</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-teal-950 sm:text-4xl">Pinagkakatiwalaan ng mga Pilipinong negosyante.</h2>
        </div>
        <div className="mt-10 mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-white p-6 shadow-xl sm:p-10">
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
    <section className="bg-[linear-gradient(180deg,#FFFFFF_0%,#EDF7F1_100%)] py-16 sm:py-20" id="faq">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">Mga madalas itanong</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-teal-950 sm:text-4xl">May tanong? Narito ang sagot.</h2>
          <p className="mt-4 text-sm leading-6 text-ink/60">Alamin ang mga pangunahing impormasyon tungkol sa JOM HUB — mula sa pag-sign up hanggang sa pag-kita ng referral fees.</p>
        </div>
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm transition hover:shadow-md">
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
          <p className="text-sm text-ink/50">Hindi mo nakita ang sagot? I-contact ang aming admin sa <a href="mailto:nolascoaubrey32@gmail.com" className="font-semibold text-teal-700 underline">nolascoaubrey32@gmail.com</a></p>
        </div>
      </div>
    </section>

    <GrowthSection />

    <RegistrationCalendar />

    {content.sections?.benefits !== false && <section id="benefits" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Ginawa para sa tunay na negosyo</p><h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Lahat ng kailangan mo para bumili, magbenta, at lumago nang may kumpiyansa.</h2><p className="mt-4 text-ink/60">Pinapalitan ng JOM HUB ang scattered chats, manual records, at disconnected payment tracking — lahat nasa isang organized workspace.</p></div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{benefits.map(({ icon: Icon, title, text }) => <div key={title} className="group rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-teal-100 hover:shadow-soft"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-600 group-hover:text-white"><Icon size={19} /></span><h3 className="mt-4 font-display text-base font-bold text-ink sm:text-lg">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/60">{text}</p></div>)}</div>
    </section>}

    {content.sections?.process !== false && <section className="bg-teal-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-mango-300">Paano gumagana ang JOM HUB</p><h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Mas malinaw na daan mula sa pagtuklas hanggang sa pagbabayad.</h2></div><Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-mango-300">Tingnan ang marketplace <ArrowRight size={16} /></Link></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{transactionSteps.map(({ icon: Icon, title, text }, index) => <div key={title} className="relative rounded-2xl border border-white/10 bg-white/[0.07] p-5"><span className="absolute right-4 top-4 font-display text-3xl font-bold text-white/[0.08]">0{index + 1}</span><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mango-500 text-ink"><Icon size={21} /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>)}</div>
      </div>
    </section>}

    {content.sections?.subscription !== false && <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" id="subscribe">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700"><Store size={14} /> Para sa Merchants</span><h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">Paano mag-subscribe at buksan ang iyong store</h2><p className="mt-4 leading-7 text-ink/60">Gumawa ng Merchant profile, pumili ng subscription, at mag-upload ng payment screenshot. Susuriin ng Admin ang application bago i-activate ang iyong store.</p>
        <div className="mt-6 space-y-3">{['Ipasok ang iyong Gmail, i-type ang 6-digit OTP, at piliin ang Merchant.', 'Kumpletuhin ang iyong business details at mag-upload ng valid business permit.', 'Pumili ng 6 months, 1 year, o 2 years at i-upload ang payment proof.', 'Maghintay ng Admin approval, pagkatapos ay pamahalaan ang iyong products at orders.'].map((text, index) => <div key={text} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">{index + 1}</span><p className="pt-0.5 text-sm leading-6 text-ink/65">{text}</p></div>)}</div>
        <Link to="/signup" className="mt-7 inline-flex items-center gap-2 font-semibold text-teal-700">Gumawa ng Merchant account <ArrowRight size={17} /></Link></div>
        <div className="grid gap-4 sm:grid-cols-3">{plans.map((plan) => <div key={plan.duration} className={`relative rounded-2xl border bg-white p-6 shadow-card ${plan.featured ? 'border-teal-500 ring-4 ring-teal-50' : 'border-black/[0.06]'}`}>{plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Recommended</span>}<p className="text-sm font-semibold text-ink/60">{plan.duration}</p><p className="mt-2 font-display text-3xl font-bold text-ink">{plan.price}</p><p className="mt-2 text-xs leading-5 text-ink/45">{plan.note}</p><div className="mt-5 space-y-2 text-xs text-ink/60"><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Store access</p><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Business reports</p><p className="flex gap-2"><Check size={14} className="text-teal-600" /> Admin review</p></div></div>)}</div>
      </div>
    </section>}

    {content.sections?.topup !== false && <section className="border-y border-black/5 bg-white py-16 sm:py-20" id="topup"><div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center"><div className="rounded-[1.75rem] bg-mango-100/60 p-6 sm:p-8"><div className="grid gap-3 sm:grid-cols-2">{[{ icon: CircleDollarSign, title: 'Scan and pay', text: 'Gamitin ang JOM HUB InstaPay QR para kay AUBREY NOLASCO at ilagay ang amount.' }, { icon: FileImage, title: 'Mag-upload ng proof', text: 'I-upload ang screenshot at ang one-use reference number.' }, { icon: Clock3, title: 'Admin verification', text: 'Itinutugma ng Admin ang tunay na payment; blocked ang duplicate references.' }, { icon: Wallet, title: 'Wallet credit', text: 'Lumalabas ang approved funds sa wallet balance.' }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl bg-white p-5 shadow-sm"><Icon size={20} className="text-mango-600" /><h3 className="mt-3 font-bold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-ink/55">{text}</p></div>)}</div></div>
        <div><span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold text-mango-600"><Wallet size={14} /> Para sa Resellers</span><h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">Paano gumagana ang Reseller registration</h2><p className="mt-4 leading-7 text-ink/60">Ilagay ang iyong Gmail, i-type ang 6-digit OTP, piliin ang Reseller, at kumpletuhin ang iyong contact at delivery address. Mag-submit ng initial top-up proof para sa Admin verification at account approval.</p><div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50 p-5"><p className="font-semibold text-teal-900">Pagkatapos ng account approval</p><p className="mt-1 text-sm leading-6 text-ink/60">Mag-browse ng approved products, pamahalaan ang mga customer at orders, at gamitin ang Wallet para sa future top-ups.</p></div><Link to="/signup" className="mt-7 inline-flex items-center gap-2 font-semibold text-teal-700">Mag-register bilang Reseller <ArrowRight size={17} /></Link></div>
      </div></section>}

    {content.sections?.final_cta !== false && <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20"><div className="relative overflow-hidden rounded-[2rem] bg-teal-900 px-6 py-10 text-center text-white shadow-xl sm:px-12 sm:py-14"><div className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-teal-500/25 blur-3xl" /><div className="relative mx-auto max-w-2xl"><h2 className="font-display text-3xl font-bold sm:text-4xl">Handa ka nang palaguin ang iyong negosyo?</h2><p className="mt-4 text-sm leading-6 text-white/60 sm:text-base">Sumali sa JOM HUB bilang Merchant o Reseller at pamahalaan ang iyong marketplace activity sa isang propesyonal na workspace.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-mango-500 px-6 py-3 font-bold text-ink hover:bg-mango-600">Gumawa ng account <ArrowRight size={17} /></Link><Link to="/catalog" className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-6 py-3 font-semibold hover:bg-white/15">Tingnan ang mga produkto</Link></div></div></div></section>}
    <JomBits publicMode />
  </div>
}

