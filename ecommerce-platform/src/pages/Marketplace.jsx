import { useState } from 'react'
import { Package, Handshake } from 'lucide-react'
import Catalog from './Catalog'
import ClinicDiscovery from './Reseller/ClinicDiscovery'

// One entry point for everything a Reseller/Merchant can browse and buy
// or refer — Products (Catalog.jsx) and Services (ClinicDiscovery.jsx)
// used to be two separate top-level nav items. Composed here via tabs
// rather than merged into one component, since they're two genuinely
// different data models (products vs. referral services) that already
// worked correctly on their own — no logic duplicated, just switched.
const TABS = [
  { id: 'products', label: 'Products', icon: Package },
  { id: 'services', label: 'Services', icon: Handshake },
]

export default function Marketplace() {
  const [tab, setTab] = useState('products')

  return (
    <div>
      <div className="sticky top-16 z-20 border-b border-black/[0.06] bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${tab === id ? 'border-teal-600 text-teal-700' : 'border-transparent text-ink/50 hover:text-ink/75'}`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'products' ? <Catalog /> : <ClinicDiscovery />}
    </div>
  )
}
