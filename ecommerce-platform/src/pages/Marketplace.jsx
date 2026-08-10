import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutGrid, UtensilsCrossed, Handshake, Store, Percent, Zap, ShoppingBag, ShoppingCart, Sparkles, House, Cpu, Shirt } from 'lucide-react'
import Catalog from './Catalog'
import ClinicDiscovery from './Reseller/ClinicDiscovery'
import StoreDirectory from './StoreDirectory'

// Grocery & Food category id from the live `categories` table (same
// one src/config/sampleProducts.js already hardcodes for the same
// reason: this file already targets one specific database).
const CATEGORY_IDS = {
  grocery: '923f9b66-1850-4e50-b255-d76b8ac35587',
  home: 'e0e74645-7975-4ed8-88b3-e2af404b2518',
  electronics: 'f387cca1-b625-4dc4-9618-e03d9706a977',
  fashion: 'b6f988c5-4cb5-4d71-9e84-594ac99b4983',
}

// Real Estate and Clinic used to be their own top-level icons here --
// moved inside Services (Reseller/ClinicDiscovery.jsx) as sub-filters
// per the owner's explicit request, since they're really two flavors
// of the same "Services" content, not separate marketplace sections.
const NAV_ICONS = [
  { key: 'all', label: 'All Products', icon: LayoutGrid, params: {} },
  { key: 'grocery', label: 'Grocery & Food', icon: UtensilsCrossed, params: { tab: 'products', category: CATEGORY_IDS.grocery, sidebar: '0' } },
  { key: 'home', label: 'Home & Living', icon: House, params: { tab: 'products', category: CATEGORY_IDS.home, sidebar: '0' } },
  { key: 'electronics', label: 'Electronics', icon: Cpu, params: { tab: 'products', category: CATEGORY_IDS.electronics, sidebar: '0' } },
  { key: 'fashion', label: 'Fashion', icon: Shirt, params: { tab: 'products', category: CATEGORY_IDS.fashion, sidebar: '0' } },
  { key: 'services', label: 'Business Services', icon: Handshake, params: { tab: 'services' } },
  { key: 'stores', label: 'Verified Stores', icon: Store, params: { tab: 'stores' } },
  { key: 'discount', label: 'Product Deals', icon: Percent, params: { tab: 'products', discount: '1' } },
  { key: 'campaign', label: 'Live Campaigns', icon: Zap, params: { tab: 'products', campaign: '1' } },
]

export default function Marketplace() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const tab = ['services', 'stores'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'products'
  const category = searchParams.get('category')
  const discountOnly = searchParams.get('discount') === '1'
  const campaignOnly = searchParams.get('campaign') === '1'

  const activeKey = tab === 'services' ? 'services'
    : tab === 'stores' ? 'stores'
    : campaignOnly ? 'campaign'
    : discountOnly ? 'discount'
    : Object.entries(CATEGORY_IDS).find(([, id]) => id === category)?.[0] || 'all'

  const goTo = (params) => {
    const next = new URLSearchParams()
    const q = searchParams.get('q')
    if (q) next.set('q', q)
    Object.entries(params).forEach(([key, value]) => next.set(key, value))
    navigate(`/marketplace${next.toString() ? `?${next.toString()}` : ''}`)
  }

  return (
    <div className="marketplace-luxe min-h-screen bg-bg">
      <section className="marketplace-reference-hero relative overflow-hidden border-b border-emerald-400/15 text-white">
        <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-16 h-80 w-80 rounded-full border-[70px] border-emerald-400/[0.06]" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-10 text-center sm:px-6 sm:py-14 lg:py-16">
          <div className="absolute left-6 top-1/2 hidden -translate-y-1/2 rotate-[-10deg] text-emerald-300/20 lg:block"><ShoppingBag size={132} strokeWidth={1} /></div>
          <div className="absolute right-5 top-1/2 hidden -translate-y-1/2 rotate-[8deg] text-emerald-300/20 lg:block"><ShoppingCart size={142} strokeWidth={1} /></div>
          <div className="inline-flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 font-display text-lg font-black shadow-[0_0_28px_rgba(16,185,129,.25)]">JH</span><div className="text-left"><p className="font-display text-2xl font-black leading-none">JOM <span className="text-emerald-400">HUB</span></p><p className="mt-1 text-[10px] text-white/45">Smart Shopping. Easy Living.</p></div></div>
          <span className="mt-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-200"><Sparkles size={13} /> One trusted marketplace</span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">Smart <span className="text-white/35">·</span> <span className="text-mango-400">Fast</span> <span className="text-white/35">·</span> <span className="text-emerald-400">Reliable</span></h1>
          <p className="mt-3 text-base text-emerald-50/60 sm:text-lg">Everything your business needs in one hub.</p>
        </div>
      </section>
      <div className="sticky top-16 z-20 border-b border-emerald-400/15 bg-[#031b12]/95 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="mx-auto flex gap-4 overflow-x-auto px-4 py-4 sm:justify-center sm:gap-6 sm:px-6">
          {NAV_ICONS.map(({ key, label, icon: Icon, params }) => {
            const active = key === activeKey
            return (
              <button key={key} type="button" onClick={() => goTo(params)} className="flex shrink-0 flex-col items-center gap-1.5 text-center">
                <span className={`grid h-12 w-12 place-items-center rounded-full border transition sm:h-14 sm:w-14 ${active ? 'border-emerald-300/70 bg-emerald-500 text-white shadow-[0_0_24px_rgba(16,185,129,.28)]' : 'border-emerald-300/15 bg-emerald-950/70 text-emerald-300 hover:border-emerald-300/40 hover:bg-emerald-900'}`}><Icon size={20} /></span>
                <span className={`whitespace-nowrap text-[11px] font-semibold sm:text-xs ${active ? 'text-emerald-300' : 'text-white/55'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div id="marketplace-products">{tab === 'services' ? <ClinicDiscovery /> : tab === 'stores' ? <StoreDirectory /> : <Catalog />}</div>
    </div>
  )
}
