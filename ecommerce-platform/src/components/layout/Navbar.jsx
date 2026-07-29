import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingCart, House, Package, LayoutDashboard, ShieldCheck, LogOut, User, Handshake, Menu, X, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { getAdminHomePath } from '../../config/adminPermissions'
import { useTheme } from '../../hooks/useTheme'

export default function Navbar() {
  const { user, profile, role, signOut } = useAuth()
  const { totalCount } = useCart()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const customerStorefront = pathname.startsWith('/store/') || pathname.startsWith('/reseller-store/')

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
    navigate('/login')
  }

  const dashLink = ['admin', 'staff'].includes(role) ? getAdminHomePath(profile) : role === 'merchant' ? '/merchant' : '/reseller'

  if (customerStorefront) return null

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.05] bg-[#f7faf7]/90 shadow-[0_8px_30px_rgba(7,59,37,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-[#07120d]/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6">
        <Link to="/" className="block shrink-0" onClick={() => setMenuOpen(false)} aria-label="JOM HUB home">
          <img src={theme === 'dark' ? '/rmhub-logo-dark.svg' : '/rmhub-logo.svg'} alt="JOM HUB" className="h-9 w-auto sm:h-12" />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-black/[0.05] bg-white/70 p-1.5 text-sm font-semibold text-ink/70 shadow-sm md:flex dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
          <Link to="/" className="flex items-center gap-1.5 rounded-full px-4 py-2 transition hover:bg-white hover:text-teal-700 hover:shadow-sm dark:hover:bg-slate-800"><House size={16} /> Home</Link>
          {user && <Link to="/catalog" className="flex items-center gap-1.5 rounded-full px-4 py-2 transition hover:bg-white hover:text-teal-700 hover:shadow-sm dark:hover:bg-slate-800"><Package size={16} /> Products</Link>}
          {user && <Link to="/clinics" className="flex items-center gap-1.5 rounded-full px-4 py-2 transition hover:bg-white hover:text-teal-700 hover:shadow-sm dark:hover:bg-slate-800"><Handshake size={16} /> Services</Link>}
          {user && (
            <Link to={dashLink} className="flex items-center gap-1.5 rounded-full px-4 py-2 transition hover:bg-white hover:text-teal-700 hover:shadow-sm dark:hover:bg-slate-800">
              <LayoutDashboard size={16} /> Workspace
            </Link>
          )}
          {role === 'admin' && (
            <Link to="/admin" className="flex items-center gap-1.5 rounded-full px-4 py-2 transition hover:bg-white hover:text-teal-700 hover:shadow-sm dark:hover:bg-slate-800">
              <ShieldCheck size={16} /> Admin
            </Link>
          )}
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

          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-xl text-ink/70 transition-colors hover:bg-teal-50 md:hidden dark:text-slate-200" aria-label="Toggle menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-black/5 bg-white px-3 py-3 text-sm font-medium text-ink/70 shadow-lg md:hidden dark:border-white/10 dark:bg-slate-900 sm:px-6">
          <Link to="/" className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-teal-50 hover:text-teal-600" onClick={() => setMenuOpen(false)}><House size={17} /> Home</Link>
          {user && <Link to="/catalog" className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-teal-50 hover:text-teal-600" onClick={() => setMenuOpen(false)}><Package size={17} /> Products</Link>}
          {user && <Link to="/clinics" className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-teal-50 hover:text-teal-600" onClick={() => setMenuOpen(false)}><Handshake size={17} /> Services</Link>}
          {user && (
            <Link to={dashLink} className="flex min-h-11 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-teal-50 hover:text-teal-600" onClick={() => setMenuOpen(false)}>
              <LayoutDashboard size={16} /> Dashboard
            </Link>
          )}
          {role === 'admin' && (
            <Link to="/admin" className="flex min-h-11 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-teal-50 hover:text-teal-600" onClick={() => setMenuOpen(false)}>
              <ShieldCheck size={16} /> Admin
            </Link>
          )}

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
