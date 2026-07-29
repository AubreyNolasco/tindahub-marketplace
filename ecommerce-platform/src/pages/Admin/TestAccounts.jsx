import { Link } from 'react-router-dom'
import { ShieldAlert, Store, UserRound, ArrowRight } from 'lucide-react'

export default function TestAccounts() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Test Accounts</h1>
        <p className="mt-1 text-sm text-ink/50">Legacy demo accounts have been removed.</p>
      </div>

      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mango-100 text-mango-700"><ShieldAlert size={26} /></span>
        <p className="font-bold text-ink">No test accounts configured</p>
        <p className="max-w-sm text-sm text-ink/50">
          merchant@gmail.com and reseller@gmail.com were deleted. Admin testing and demos now go through
          a full-access admin account instead.
        </p>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-display font-bold text-ink">Preview dashboards</h2>
        <p className="mb-4 text-xs text-ink/50">
          Opens the dashboard layout using your own Admin account — no separate sign-in needed.
          Role-specific data (orders, wallet, etc.) will be empty since it isn't tied to a real
          reseller or merchant.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/reseller" className="card group flex items-center gap-3 p-5 hover:border-mango-200">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mango-100 text-mango-700"><UserRound size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">Reseller Dashboard</p>
              <p className="text-xs text-ink/50">View the reseller workspace</p>
            </div>
            <ArrowRight size={16} className="text-ink/30 group-hover:text-mango-600" />
          </Link>
          <Link to="/merchant" className="card group flex items-center gap-3 p-5 hover:border-teal-100">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-700"><Store size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">Merchant Dashboard</p>
              <p className="text-xs text-ink/50">View the merchant workspace</p>
            </div>
            <ArrowRight size={16} className="text-ink/30 group-hover:text-teal-600" />
          </Link>
        </div>
      </div>
    </div>
  )
}
