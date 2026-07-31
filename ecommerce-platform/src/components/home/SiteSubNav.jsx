import { NavLink } from 'react-router-dom'
import { HelpCircle, House, Route, Star, Store, UsersRound, Handshake } from 'lucide-react'

const LINKS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/how-it-works', label: 'How It Works', icon: Route },
  { to: '/for-merchants', label: 'For Merchants', icon: Store },
  { to: '/for-resellers', label: 'For Resellers', icon: UsersRound },
  { to: '/services', label: 'Services', icon: Handshake },
  { to: '/testimonials', label: 'Testimonials', icon: Star },
  { to: '/faq', label: 'FAQ', icon: HelpCircle }
]

export default function SiteSubNav() {
  return (
    <nav className="sticky top-16 z-30 border-b border-black/[0.05] bg-[#f7faf7]/90 backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-[#07120d]/90">
      <div className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-3 py-2 sm:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all duration-200 ${isActive ? 'bg-teal-700 text-white shadow-sm shadow-teal-900/20' : 'text-ink/60 hover:scale-105 hover:bg-teal-50 hover:text-teal-700 active:scale-95'}`}
          >
            <Icon size={14} /> {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
