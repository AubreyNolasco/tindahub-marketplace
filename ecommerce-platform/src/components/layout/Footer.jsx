import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, BarChart3, Mail, ShieldCheck, Store } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-16 overflow-hidden bg-teal-950 text-white">
      <div className="border-b border-white/10 bg-teal-900/50"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="font-display text-xl font-bold">Ready to grow with JOM HUB?</p><p className="mt-1 text-sm text-white/55">Create your professional Merchant or Reseller workspace today.</p></div><Link to="/signup" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-mango-500 px-5 py-3 text-sm font-bold text-ink transition hover:bg-mango-600">Join the marketplace <ArrowRight size={16} /></Link></div></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="inline-block rounded-xl bg-white px-2"><img src="/rmhub-logo.svg" alt="JOM HUB" className="h-14 w-auto" /></Link>
          <p className="text-sm text-white/55 mt-4 max-w-xs leading-6">
            Ang B2B marketplace na nagkokonekta sa mga merchant at reseller sa buong Pilipinas.
          </p>
        </div>

        <div>
          <p className="font-semibold text-white text-sm mb-4">Marketplace</p>
          <div className="flex flex-col gap-3 text-sm text-white/55">
            <Link to="/catalog" className="hover:text-mango-300 transition-colors">Browse Products</Link>
            <Link to="/signup" className="hover:text-mango-300 transition-colors">Become a Merchant</Link>
            <Link to="/signup" className="hover:text-mango-300 transition-colors">Become a Reseller</Link>
            <Link to="/login" className="hover:text-mango-300 transition-colors">Account Login</Link>
          </div>
        </div>

        <div>
          <p className="font-semibold text-white text-sm mb-4">Why JOM HUB</p>
          <div className="flex flex-col gap-3 text-sm text-white/55"><span className="flex items-center gap-2"><Store size={15} className="text-mango-300" /> Professional storefronts</span><span className="flex items-center gap-2"><BarChart3 size={15} className="text-mango-300" /> Downloadable reports</span><span className="flex items-center gap-2"><BadgeCheck size={15} className="text-mango-300" /> Admin-reviewed access</span><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-mango-300" /> Protected workflows</span></div>
        </div>

        <div>
          <p className="font-semibold text-white text-sm mb-4">Support & Policy</p>
          <div className="flex flex-col gap-3 text-sm text-white/55">
            <a href="mailto:support@tindahub.ph" className="hover:text-mango-300 transition-colors flex items-center gap-2">
              <Mail size={15} /> support@tindahub.ph
            </a>
            <Link to="/legal/terms" className="hover:text-mango-300 transition-colors">Terms</Link><Link to="/legal/privacy" className="hover:text-mango-300 transition-colors">Privacy</Link><Link to="/legal/merchant" className="hover:text-mango-300 transition-colors">Merchant Agreement</Link><Link to="/legal/reseller" className="hover:text-mango-300 transition-colors">Reseller Agreement</Link><Link to="/legal/commission" className="hover:text-mango-300 transition-colors">Commission Policy</Link><Link to="/legal/refund" className="hover:text-mango-300 transition-colors">Refund Policy</Link><Link to="/legal/cookie" className="hover:text-mango-300 transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 text-xs text-white/35 text-center">
          © {new Date().getFullYear()} JOM HUB. Built for growing businesses.
        </div>
      </div>
    </footer>
  )
}
