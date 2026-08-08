import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutGrid, UtensilsCrossed, Package, Handshake, Building2, Stethoscope, Store, Percent, Zap } from 'lucide-react'
import Catalog from './Catalog'
import ClinicDiscovery from './Reseller/ClinicDiscovery'

// Grocery & Food category id from the live `categories` table (same
// one src/config/sampleProducts.js already hardcodes for the same
// reason: this file already targets one specific database).
const GROCERY_FOOD_CATEGORY_ID = '923f9b66-1850-4e50-b255-d76b8ac35587'

// Replaces both the old Products/Services tab pair and Catalog.jsx's
// own category-icon row with the mockup's single icon row. Every icon
// drives a real filter, not a decorative link to nowhere:
// Food/Discount/Stores/Flash Sale filter Catalog.jsx (via the same
// ?category=/?discount=1/?filters=1/?scrollTo= URL params it already
// reads), Real Estate/Clinic filter ClinicDiscovery.jsx via
// ?serviceType= (merchant_profiles.service_type is a real field).
const NAV_ICONS = [
  { key: 'all', label: 'All Categories', icon: LayoutGrid, params: {} },
  { key: 'food', label: 'Food', icon: UtensilsCrossed, params: { tab: 'products', category: GROCERY_FOOD_CATEGORY_ID } },
  { key: 'items', label: 'Items', icon: Package, params: { tab: 'products' } },
  { key: 'services', label: 'Services', icon: Handshake, params: { tab: 'services' } },
  { key: 'real_estate', label: 'Real Estate', icon: Building2, params: { tab: 'services', serviceType: 'real_estate' } },
  { key: 'clinic', label: 'Clinic', icon: Stethoscope, params: { tab: 'services', serviceType: 'clinic' } },
  { key: 'stores', label: 'Stores', icon: Store, params: { tab: 'products', filters: '1' } },
  { key: 'discount', label: 'Discount', icon: Percent, params: { tab: 'products', discount: '1' } },
  { key: 'flash_sale', label: 'Flash Sale', icon: Zap, params: { tab: 'products', scrollTo: 'flash-sale' } },
]

export default function Marketplace() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const tab = searchParams.get('tab') === 'services' ? 'services' : 'products'
  const category = searchParams.get('category')
  const serviceType = searchParams.get('serviceType')
  const discountOnly = searchParams.get('discount') === '1'

  const activeKey = tab === 'services'
    ? (serviceType === 'real_estate' ? 'real_estate' : serviceType === 'clinic' ? 'clinic' : 'services')
    : discountOnly ? 'discount' : category === GROCERY_FOOD_CATEGORY_ID ? 'food' : 'all'

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
      {tab === 'products' ? <Catalog /> : <ClinicDiscovery />}
    </div>
  )
}
