import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Store, Package, LayoutDashboard, ShieldCheck, LogOut, User, Menu, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { getAdminHomePath } from '../../config/adminPermissions'

export default function Navbar() {
  const { user, profile, role, signOut } = useAuth()
  const { totalCount } = useCart()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
    navigate('/login')
  }

  const dashLink =
    ['admin', 'staff'].includes(role) ? getAdminHomePath(profile) : role === 'merchant' ? '/merchant' : '/reseller'

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 shadow-sm shadow-teal-950/[0.02] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between">
        <Link to="/" className="block shrink-0" onClick={() => setMenuOpen(false)} aria-label="RM Hub home">
          <img src="/rmhub-logo.svg" alt="RM HUB" className="h-11 w-auto sm:h-12" />
        </Link>

        <nav className="hidden md:flex items-center gap-1 rounded-full border border-black/[0.05] bg-cream/80 p-1.5 text-sm font-semibold text-ink/65">
          <Link to="/" className="flex items-center gap-1.5 rounded-full px-4 py-2 transition hover:bg-white hover:text-teal-700 hover:shadow-sm"><Store size={16} /> Store</Link>
          <Link to="/catalog" className="flex items-center gap-1.5 rounded-full px-4 py-2 transition hover:bg-white hover:text-teal-700 hover:shadow-sm"><Package size={16} /> Products</Link>
          {user && (
            <Link to={dashLink} className="hover:text-teal-600 transition-colors flex items-center gap-1">
              <LayoutDashboard size={16} /> Workspace
            </Link>
          )}
          {role === 'admin' && (
            <Link to="/admin" className="hover:text-teal-600 transition-colors flex items-center gap-1">
              <ShieldCheck size={16} /> Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          {(role === 'reseller' || role === 'merchant') && (
            <Link to="/cart" className="relative p-2 rounded-full hover:bg-teal-50 transition-colors">
              <ShoppingCart size={20} className="text-ink/70" />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-coral-500 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] h-[18px] flex items-center justify-center">
                  {totalCount}
                </span>
              )}
            </Link>
          )}

          {user ? (
            <div className="hidden sm:flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm text-ink/70">
                <User size={16} /> {typeof profile?.full_name === 'string' ? profile.full_name.split(' ')[0] : 'User'}
              </span>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-full hover:bg-coral-100 text-ink/60 hover:text-coral-600 transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link to="/login" className="btn-primary px-4 py-2 text-sm">Sign in with email</Link>
            </div>
          )}

          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-full hover:bg-teal-50 text-ink/70 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-black/5 bg-cream px-4 sm:px-6 py-4 flex flex-col gap-1 text-sm font-medium text-ink/70">
          <Link to="/" className="py-2.5 hover:text-teal-600 transition-colors flex items-center gap-2" onClick={() => setMenuOpen(false)}><Store size={16} /> Store</Link>
          <Link to="/catalog" className="py-2.5 hover:text-teal-600 transition-colors flex items-center gap-2" onClick={() => setMenuOpen(false)}><Package size={16} /> Product</Link>
          {user && (
            <Link to={dashLink} className="py-2.5 hover:text-teal-600 transition-colors flex items-center gap-2" onClick={() => setMenuOpen(false)}>
              <LayoutDashboard size={16} /> Dashboard
            </Link>
          )}
          {role === 'admin' && (
            <Link to="/admin" className="py-2.5 hover:text-teal-600 transition-colors flex items-center gap-2" onClick={() => setMenuOpen(false)}>
              <ShieldCheck size={16} /> Admin
            </Link>
          )}

          {user ? (
            <div className="pt-2 mt-2 border-t border-black/5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-ink/70">
                <User size={16} /> {typeof profile?.full_name === 'string' ? profile.full_name.split(' ')[0] : 'User'}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-sm font-semibold text-coral-600"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          ) : (
            <div className="pt-2 mt-2 border-t border-black/5">
              <Link to="/login" className="btn-primary block w-full px-4 py-2 text-center text-sm" onClick={() => setMenuOpen(false)}>Sign in with email</Link>
            </div>
          )}
        </nav>
      )}
    </header>
  )
}
