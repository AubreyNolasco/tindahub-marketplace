import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, BadgeCheck, BarChart3, Mail, ShieldCheck, Store } from 'lucide-react'

export default function Footer() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/store/') || pathname.startsWith('/reseller-store/')) return null

  return (
    <footer className="mt-16 overflow-hidden bg-teal-950 text-white">
      <div className="border-b border-white/10 bg-teal-900/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-display text-xl font-semibold">Ready to grow with JOM HUB?</p>
            <p className="mt-1 text-sm text-white/60">Create your professional Merchant or Reseller workspace today.</p>
          </div>
          <Link to="/signup" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[1rem] bg-mango-500 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-mango-600">Join the marketplace <ArrowRight size={16} /></Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="inline-block rounded-[1rem] bg-white px-2">
            <img src="/rmhub-logo.svg" alt="JOM HUB" className="h-14 w-auto" />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-7 text-white/60">The B2B marketplace connecting Merchants and Resellers across the Philippines.</p>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">Marketplace</p>
          <div className="flex flex-col gap-3 text-sm text-white/60">
            <Link to="/catalog" className="transition-colors hover:text-mango-300">Browse Products</Link>
            <Link to="/signup" className="transition-colors hover:text-mango-300">Become a Merchant</Link>
            <Link to="/signup" className="transition-colors hover:text-mango-300">Become a Reseller</Link>
            <Link to="/login" className="transition-colors hover:text-mango-300">Account Login</Link>
          </div>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">Why JOM HUB</p>
          <div className="flex flex-col gap-3 text-sm text-white/60">
            <span className="flex items-center gap-2"><Store size={15} className="text-mango-300" /> Professional storefronts</span>
            <span className="flex items-center gap-2"><BarChart3 size={15} className="text-mango-300" /> Downloadable reports</span>
            <span className="flex items-center gap-2"><BadgeCheck size={15} className="text-mango-300" /> Admin-reviewed access</span>
            <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-mango-300" /> Protected workflows</span>
          </div>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">Support & Policy</p>
          <div className="flex flex-col gap-3 text-sm text-white/60">
            <a href="mailto:nolascoaubrey32@gmail.com" className="flex items-center gap-2 transition-colors hover:text-mango-300"><Mail size={15} /> nolascoaubrey32@gmail.com</a>
            <Link to="/legal/terms" className="transition-colors hover:text-mango-300">Terms</Link>
            <Link to="/legal/privacy" className="transition-colors hover:text-mango-300">Privacy</Link>
            <Link to="/legal/merchant" className="transition-colors hover:text-mango-300">Merchant Agreement</Link>
            <Link to="/legal/reseller" className="transition-colors hover:text-mango-300">Reseller Agreement</Link>
            <Link to="/legal/commission" className="transition-colors hover:text-mango-300">Commission Policy</Link>
            <Link to="/legal/refund" className="transition-colors hover:text-mango-300">Refund Policy</Link>
            <Link to="/legal/cookie" className="transition-colors hover:text-mango-300">Cookie Policy</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-white/35 sm:px-6">© {new Date().getFullYear()} JOM HUB. Built for growing businesses.</div>
      </div>
    </footer>
  )
}
