import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingCart, House, Route, Store, UsersRound, Handshake, Star, HelpCircle, LogOut, User, Menu, X, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
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

export default function Navbar() {
  const { user, profile, role, signOut } = useAuth()
  const { totalCount } = useCart()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const customerStorefront = pathname.startsWith('/store/') || pathname.startsWith('/reseller-store/')

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleSignOut = async () => {
    setMenuOpen(false)
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
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex items-center gap-1.5 text-sm text-ink/70 dark:text-slate-200">
                <User size={16} /> {typeof profile?.full_name === 'string' ? profile.full_name.split(' ')[0] : 'User'}
              </span>
              <button type="button" onClick={handleSignOut} className="rounded-full p-2 text-ink/60 transition-colors hover:bg-coral-100 hover:text-coral-600 dark:text-slate-200" title="Sign out"><LogOut size={18} /></button>
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
            <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2">
              <span className="flex items-center gap-1.5 text-sm text-ink/70 dark:text-slate-200">
                <User size={16} /> {typeof profile?.full_name === 'string' ? profile.full_name.split(' ')[0] : 'User'}
              </span>
              <button type="button" onClick={handleSignOut} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-coral-600 hover:bg-coral-50">
                <LogOut size={16} /> Sign out
              </button>
            </div>
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
