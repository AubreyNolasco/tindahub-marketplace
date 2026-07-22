import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, Boxes, Building2, ChevronRight, CircleDollarSign,
  ClipboardList, CreditCard, FileChartColumn, FileDown,
  FileUp, FolderTree, House, LayoutDashboard, Menu, MessageSquare,
  Megaphone, PanelLeftClose, ReceiptText, ShieldCheck, Star, UsersRound, WalletCards, X, History, CalendarDays, UserCog, Scale, BookOpenCheck, KeyRound
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { canAccessAdmin } from '../../config/adminPermissions'
import AdminNotifications from '../../components/notifications/AdminNotifications'

const sections = [
  {
    label: 'Workspace',
    items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, permission: 'overview' },
      { to: '/admin/staff', label: 'Staff Access', icon: UserCog, adminOnly: true },
      { to: '/admin/full-access', label: 'Full Access', icon: KeyRound, adminOnly: true },
      { to: '/admin/products', label: 'Products', icon: Boxes, adminOnly: true },
      { to: '/admin/legal', label: 'Legal Settings', icon: Scale, adminOnly: true },
      { to: '/admin/process-guide', label: 'Process Guide', icon: BookOpenCheck, adminOnly: true },
      { to: '/admin/merchants', label: 'Merchants', icon: Building2, permission: 'merchants' },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree, permission: 'categories' },
      { to: '/admin/homepage', label: 'Homepage', icon: House, permission: 'homepage' },
      { to: '/admin/chats', label: 'Chat History', icon: MessageSquare, permission: 'chats' },
      { to: '/admin/login-history', label: 'Login History', icon: History, permission: 'login_history' },
      { to: '/admin/reviews', label: 'Reviews & Ratings', icon: Star, permission: 'reviews' },
      { to: '/admin/campaigns', label: 'Campaigns', icon: Megaphone, permission: 'campaigns' },
      { to: '/admin/registrations', label: 'Registration Calendar', icon: CalendarDays, permission: 'registrations' }
    ]
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/payments', label: 'Payments', icon: CreditCard, permission: 'payments' },
      { to: '/admin/topups', label: 'Top-Ups', icon: CircleDollarSign, permission: 'topups' },
      { to: '/admin/withdrawals', label: 'Withdrawals', icon: WalletCards, permission: 'withdrawals' },
      { to: '/admin/wallet', label: 'Platform Wallet', icon: ReceiptText, permission: 'wallet' },
      { to: '/admin/sales', label: 'Sales', icon: BarChart3, permission: 'sales' },
      { to: '/admin/subscriptions', label: 'Subscriptions', icon: UsersRound, permission: 'subscriptions' }
    ]
  },
  {
    label: 'Reports',
    items: [
      { to: '/admin/reports/sales', label: 'Sales Report', icon: FileChartColumn, permission: 'reports' },
      { to: '/admin/reports/inventory', label: 'Inventory Report', icon: Boxes, permission: 'reports' },
      { to: '/admin/reports/topups', label: 'Top-Up Report', icon: FileUp, permission: 'reports' },
      { to: '/admin/reports/withdrawals', label: 'Withdrawal Report', icon: FileDown, permission: 'reports' },
      { to: '/admin/reports/ordered', label: 'Ordered Report', icon: ClipboardList, permission: 'reports' }
    ]
  }
]

function Sidebar({ open, collapsed, onClose, onToggleCollapse, visibleSections }) {
  return (
    <>
      {open && <button type="button" aria-label="Close admin navigation" onClick={onClose} className="fixed inset-x-0 bottom-0 top-16 z-40 bg-ink/40 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed bottom-0 left-0 top-16 z-50 flex w-[min(19rem,calc(100vw-1.5rem))] flex-col border-r border-black/10 bg-white text-ink shadow-2xl transition-transform duration-300 lg:sticky lg:z-20 lg:h-[calc(100vh-4rem)] lg:shrink-0 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-[84px]' : 'lg:w-64'}`}>
        <div className={`flex h-[76px] items-center border-b border-black/5 bg-teal-50 ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
          {!collapsed ? <div className="min-w-0"><img src="/rmhub-logo.svg" alt="JOM HUB" className="h-9 w-auto" /><p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-ink/55"><ShieldCheck size={13} className="text-mango-600" /> Admin Center</p></div> : <img src="/rmhub-mark.svg" alt="JOM HUB" className="h-10 w-10" />}
          <button onClick={onClose} className="rounded-xl p-2 text-ink/60 hover:bg-teal-100 hover:text-teal-900 lg:hidden" aria-label="Close menu"><X size={20} /></button>
          <button onClick={onToggleCollapse} className="hidden rounded-xl p-2 text-ink/60 hover:bg-teal-100 hover:text-teal-900 lg:block" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><PanelLeftClose size={19} className={collapsed ? 'rotate-180' : ''} /></button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5 scrollbar-thin">
          {visibleSections.map((section) => <div key={section.label}>
            {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/45">{section.label}</p>}
            <div className="space-y-1">{section.items.map(({ to, label, icon: Icon, end }) =>
              <NavLink key={to} to={to} end={end} onClick={onClose} title={collapsed ? label : undefined}
                className={({ isActive }) => `group relative flex min-h-11 items-center rounded-xl text-sm font-semibold transition-all ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${isActive ? 'bg-teal-600 text-white shadow-md shadow-teal-900/10' : 'text-ink/70 hover:bg-teal-50 hover:text-teal-900'}`}>
                {({ isActive }) => <><Icon size={18} className={`shrink-0 ${isActive ? 'text-white' : 'text-teal-600 group-hover:text-teal-700'}`} />{!collapsed && <><span className="flex-1 truncate">{label}</span>{isActive && <ChevronRight size={15} className="text-white" />}</>}</>}
              </NavLink>
            )}</div>
          </div>)}
        </nav>
        {!collapsed && <div className="border-t border-black/5 p-4"><div className="rounded-xl bg-teal-50 px-3 py-3"><p className="text-xs font-semibold text-teal-900">Secure admin area</p><p className="mt-0.5 text-[11px] leading-4 text-ink/55">Review payments and account requests carefully.</p></div></div>}
      </aside>
    </>
  )
}

export default function AdminLayout() {
  const { profile } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const visibleSections = sections.map((section) => ({ ...section, items: section.items.filter((item) => item.adminOnly ? profile?.role === 'admin' : !item.permission || canAccessAdmin(profile, item.permission)) })).filter((section) => section.items.length)
  const currentItem = visibleSections.flatMap((section) => section.items).find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))
  return (
    <div className="min-h-[calc(100vh-4rem)] lg:flex">
      <Sidebar open={menuOpen} collapsed={collapsed} onClose={() => setMenuOpen(false)} onToggleCollapse={() => setCollapsed((value) => !value)} visibleSections={visibleSections} />
      <section className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_right,rgba(22,121,75,0.08),transparent_30%),#F7FAF7]">
        <div className="sticky top-16 z-30 flex h-14 items-center justify-between gap-3 border-b border-black/5 bg-white/90 px-3 backdrop-blur sm:px-5 lg:px-8">
          <button onClick={() => setMenuOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 lg:hidden"><Menu size={19} /><span className="hidden sm:inline">Menu</span></button>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{currentItem?.label || 'Admin'}</p><p className="hidden text-[11px] text-ink/40 lg:block">Admin Center</p></div>
          <AdminNotifications />
        </div>
        <main className="min-w-0"><Outlet /></main>
      </section>
    </div>
  )
}
