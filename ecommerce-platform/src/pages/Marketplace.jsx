import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutGrid, UtensilsCrossed, Package, Handshake, Store, Percent, Zap } from 'lucide-react'
import Catalog from './Catalog'
import ClinicDiscovery from './Reseller/ClinicDiscovery'
import StoreDirectory from './StoreDirectory'

// Grocery & Food category id from the live `categories` table (same
// one src/config/sampleProducts.js already hardcodes for the same
// reason: this file already targets one specific database).
const GROCERY_FOOD_CATEGORY_ID = '923f9b66-1850-4e50-b255-d76b8ac35587'

// Real Estate and Clinic used to be their own top-level icons here --
// moved inside Services (Reseller/ClinicDiscovery.jsx) as sub-filters
// per the owner's explicit request, since they're really two flavors
// of the same "Services" content, not separate marketplace sections.
const NAV_ICONS = [
  { key: 'all', label: 'All Categories', icon: LayoutGrid, params: {} },
  { key: 'food', label: 'Food', icon: UtensilsCrossed, params: { tab: 'products', category: GROCERY_FOOD_CATEGORY_ID, sidebar: '0' } },
  { key: 'items', label: 'Items', icon: Package, params: { tab: 'products', excludeCategory: GROCERY_FOOD_CATEGORY_ID, sidebar: '0' } },
  { key: 'services', label: 'Services', icon: Handshake, params: { tab: 'services' } },
  { key: 'stores', label: 'Stores', icon: Store, params: { tab: 'stores' } },
  { key: 'discount', label: 'Discount', icon: Percent, params: { tab: 'products', discount: '1' } },
  { key: 'campaign', label: 'Campaign', icon: Zap, params: { tab: 'products', campaign: '1' } },
]

export default function Marketplace() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const tab = ['services', 'stores'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'products'
  const category = searchParams.get('category')
  const excludeCategory = searchParams.get('excludeCategory')
  const discountOnly = searchParams.get('discount') === '1'
  const campaignOnly = searchParams.get('campaign') === '1'

  const activeKey = tab === 'services' ? 'services'
    : tab === 'stores' ? 'stores'
    : campaignOnly ? 'campaign'
    : discountOnly ? 'discount'
    : excludeCategory === GROCERY_FOOD_CATEGORY_ID ? 'items'
    : category === GROCERY_FOOD_CATEGORY_ID ? 'food'
    : 'all'

  const goTo = (params) => {
    const next = new URLSearchParams()
    const q = searchParams.get('q')
    if (q) next.set('q', q)
    Object.entries(params).forEach(([key, value]) => next.set(key, value))
    navigate(`/marketplace${next.toString() ? `?${next.toString()}` : ''}`)
  }

  return (
    <div>
      <div className="sticky top-16 z-20 border-b border-black/[0.06] bg-surface/95 backdrop-blur">
        <div className="mx-auto flex gap-6 overflow-x-auto px-4 py-4 sm:justify-center sm:px-6">
          {NAV_ICONS.map(({ key, label, icon: Icon, params }) => {
            const active = key === activeKey
            return (
              <button key={key} type="button" onClick={() => goTo(params)} className="flex shrink-0 flex-col items-center gap-1.5 text-center">
                <span className={`grid h-12 w-12 place-items-center rounded-full transition sm:h-14 sm:w-14 ${active ? 'bg-teal-600 text-white shadow-sm' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}><Icon size={20} /></span>
                <span className={`whitespace-nowrap text-[11px] font-semibold sm:text-xs ${active ? 'text-teal-700' : 'text-ink/55'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
      {tab === 'services' ? <ClinicDiscovery /> : tab === 'stores' ? <StoreDirectory /> : <Catalog />}
    </div>
  )
}
