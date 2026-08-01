import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingCart, House, Route, Store, UsersRound, Handshake, Star, HelpCircle, LogOut, ChevronDown, LayoutDashboard, Package, ShieldCheck, Menu, X, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { getAdminHomePath } from '../../config/adminPermissions'
import { useTheme } from '../../hooks/useTheme'

const NAV_LINKS = [
  { id: 'hero', label: 'Home', icon: House },
  { id: 'how-it-works', label: 'How It Works', icon: Route },
  { id: 'for-merchants', label: 'For Merchants', icon: Store },
  { id: 'for-resellers', label: 'For Resellers', icon: UsersRound },
  { id: 'services', label: 'Services', icon: Handshake },
  { id: 'testimonials', label: 'Testimonials', icon: Star },
  { id: 'faq', label: 'FAQ', icon: HelpCircle }
]

const DASHBOARD_LABELS = { admin: 'Admin Panel', staff: 'Admin Panel', merchant: 'Merchant Dashboard', reseller: 'Reseller Dashboard' }

export default function Navbar() {
  const { user, profile, role, signOut } = useAuth()
  const { totalCount } = useCart()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const accountMenuRef = useRef(null)
  const customerStorefront = pathname.startsWith('/store/') || pathname.startsWith('/reseller-store/')
  const dashLink = ['admin', 'staff'].includes(role) ? getAdminHomePath(profile) : role === 'merchant' ? '/merchant' : '/reseller'
  const dashLabel = DASHBOARD_LABELS[role] || 'Dashboard'
  const firstName = typeof profile?.full_name === 'string' ? profile.full_name.split(' ')[0] : 'Account'

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const close = (event) => { if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) setAccountMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleSignOut = async () => {
    setMenuOpen(false)
    setAccountMenuOpen(false)
    await signOut()
    navigate('/login')
  }

  // On the homepage, smooth-scroll straight to the section. From any other
  // page, navigate to "/#id" — Home.jsx's useScrollToHash() picks up the
  // hash on mount and scrolls there once the page renders.
  const goToSection = (id) => (event) => {
    event.preventDefault()
    setMenuOpen(false)
    if (pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      navigate(`/#${id}`)
    }
  }

  if (customerStorefront) return null

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'border-b border-black/[0.05] bg-[#f7faf7]/90 shadow-[0_8px_30px_rgba(7,59,37,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-[#07120d]/90' : 'border-b border-transparent bg-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6">
        <Link to="/" className="block shrink-0" onClick={() => setMenuOpen(false)} aria-label="JOM HUB home">
          <img src={theme === 'dark' ? '/rmhub-logo-dark.svg' : '/rmhub-logo.svg'} alt="JOM HUB" className="h-9 w-auto sm:h-12" />
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-full border border-black/[0.05] bg-white/70 p-1.5 text-sm font-semibold text-ink/70 shadow-sm xl:flex dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
          {NAV_LINKS.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`/#${id}`} onClick={goToSection(id)} className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 transition hover:bg-surface hover:text-teal-700 hover:shadow-sm dark:hover:bg-slate-800">
              <Icon size={15} /> {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full p-2 text-ink/70 transition-colors hover:bg-teal-50 dark:text-slate-200 dark:hover:bg-slate-800"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {(role === 'reseller' || role === 'merchant') && (
            <Link to="/cart" className="relative rounded-full p-2 transition-colors hover:bg-teal-50 dark:hover:bg-slate-800">
              <ShoppingCart size={20} className="text-ink/70 dark:text-slate-200" />
              {totalCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral-500 text-[10px] font-bold text-white">
                  {totalCount}
                </span>
              )}
            </Link>
          )}

          {user ? (
            <div className="relative hidden sm:block" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-black/[0.05] bg-white/70 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-ink/70 shadow-sm transition hover:bg-surface dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200"
                aria-expanded={accountMenuOpen}
                aria-label="Account menu"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">{firstName.charAt(0).toUpperCase()}</span>
                <span className="max-w-[8rem] truncate">{firstName}</span>
                <ChevronDown size={15} className={`shrink-0 text-ink/40 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-black/[0.08] bg-surface shadow-2xl dark:border-white/10">
                  <div className="border-b border-black/5 px-4 py-3 dark:border-white/10">
                    <p className="truncate text-sm font-bold text-ink">{typeof profile?.full_name === 'string' ? profile.full_name : 'Account'}</p>
                    <p className="text-xs capitalize text-ink/45">{role}</p>
                  </div>
                  <div className="p-1.5">
                    <Link to={dashLink} onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink/70 transition hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-slate-800">
                      {['admin', 'staff'].includes(role) ? <ShieldCheck size={17} /> : <LayoutDashboard size={17} />} {dashLabel}
                    </Link>
                    <Link to="/catalog" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink/70 transition hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-slate-800"><Package size={17} /> Products</Link>
                    <Link to="/clinics" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink/70 transition hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-slate-800"><Handshake size={17} /> Services</Link>
                  </div>
                  <div className="border-t border-black/5 p-1.5 dark:border-white/10">
                    <button type="button" onClick={handleSignOut} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-coral-600 transition hover:bg-coral-50"><LogOut size={17} /> Sign out</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex">
              <Link to="/login" className="btn-primary px-4 py-2 text-sm">Sign in with email</Link>
            </div>
          )}

          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-xl text-ink/70 transition-colors hover:bg-teal-50 xl:hidden dark:text-slate-200" aria-label="Toggle menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-black/5 bg-surface px-3 py-3 text-sm font-medium text-ink/70 shadow-lg xl:hidden dark:border-white/10 dark:bg-slate-900 sm:px-6">
          {NAV_LINKS.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`/#${id}`} onClick={goToSection(id)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-teal-50 hover:text-teal-600">
              <Icon size={17} /> {label}
            </a>
          ))}

          {user ? (
            <>
              <div className="mt-2 border-t border-black/5 pt-2">
                <Link to={dashLink} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-teal-50 hover:text-teal-600">
                  {['admin', 'staff'].includes(role) ? <ShieldCheck size={17} /> : <LayoutDashboard size={17} />} {dashLabel}
                </Link>
                <Link to="/catalog" onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-teal-50 hover:text-teal-600"><Package size={17} /> Products</Link>
                <Link to="/clinics" onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-teal-50 hover:text-teal-600"><Handshake size={17} /> Services</Link>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2">
                <span className="flex items-center gap-1.5 text-sm text-ink/70 dark:text-slate-200">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-600 text-[11px] font-bold text-white">{firstName.charAt(0).toUpperCase()}</span> {firstName}
                </span>
                <button type="button" onClick={handleSignOut} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-coral-600 hover:bg-coral-50">
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </>
          ) : (
            <div className="mt-2 border-t border-black/5 pt-2">
              <Link to="/login" className="btn-primary block w-full px-4 py-2 text-center text-sm" onClick={() => setMenuOpen(false)}>Sign in with email</Link>
            </div>
          )}
        </nav>
      )}
    </header>
  )
}
