import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, Boxes, Building2, CircleDollarSign,
  ClipboardList, CreditCard, FileChartColumn, FileDown,
  FileUp, FolderTree, GalleryHorizontal, House, IdCard, LayoutDashboard, LifeBuoy, Menu, MessageSquare,
  Megaphone, PanelLeftClose, Presentation, ReceiptText, ShieldAlert, ShieldCheck, Star, UsersRound, WalletCards, X, History, CalendarDays, UserCog, Scale, BookOpenCheck, KeyRound, Activity, Workflow, Bug, Clock3, Truck, Plug, Ticket, Milestone
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { canAccessAdmin } from '../../config/adminPermissions'
import AdminNotifications from '../../components/notifications/AdminNotifications'
import InteractivePageGuide from '../../components/onboarding/InteractivePageGuide'
import CommandPalette from '../../components/ui/CommandPalette'
import SidebarNav from '../../components/layout/SidebarNav'
import { useTheme } from '../../hooks/useTheme'

const sections = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, permission: 'overview' }
    ]
  },
  {
    label: 'Approvals & Trust',
    items: [
      { to: '/admin/approval-center', label: 'Approval Center', icon: ShieldCheck, adminOnly: true },
      { to: '/admin/merchant-followups', label: 'Merchant Follow-Ups', icon: Clock3, permission: 'merchants' },
      { to: '/admin/merchants', label: 'Merchants', icon: Building2, permission: 'merchants' },
      { to: '/admin/order-cases', label: 'Order Cases', icon: ShieldAlert, adminOnly: true },
      { to: '/admin/products', label: 'Products', icon: Boxes, adminOnly: true },
      { to: '/admin/reseller-verifications', label: 'Reseller ID Verification', icon: IdCard, adminOnly: true }
    ]
  },
  {
    label: 'Money',
    items: [
      { to: '/admin/payments', label: 'Payments', icon: CreditCard, permission: 'payments' },
      { to: '/admin/wallet', label: 'Platform Wallet', icon: ReceiptText, permission: 'wallet' },
      { to: '/admin/sales', label: 'Sales', icon: BarChart3, permission: 'sales' },
      { to: '/admin/subscriptions', label: 'Subscriptions', icon: UsersRound, permission: 'subscriptions' },
      { to: '/admin/topups', label: 'Top-Ups', icon: CircleDollarSign, permission: 'topups' },
      { to: '/admin/withdrawals', label: 'Withdrawals', icon: WalletCards, permission: 'withdrawals' }
    ]
  },
  {
    label: 'Reports',
    items: [
      { to: '/admin/reports/campaigns', label: 'Campaign Performance', icon: Megaphone, permission: 'reports' },
      { to: '/admin/reports/inventory', label: 'Inventory Report', icon: Boxes, permission: 'reports' },
      { to: '/admin/reports/ordered', label: 'Ordered Report', icon: ClipboardList, permission: 'reports' },
      { to: '/admin/reports/sales', label: 'Sales Report', icon: FileChartColumn, permission: 'reports' },
      { to: '/admin/reports/topups', label: 'Top-Up Report', icon: FileUp, permission: 'reports' },
      { to: '/admin/reports/withdrawals', label: 'Withdrawal Report', icon: FileDown, permission: 'reports' }
    ]
  },
  {
    label: 'Content & Growth',
    items: [
      { to: '/admin/campaigns', label: 'Campaigns', icon: Megaphone, permission: 'campaigns' },
      { to: '/admin/vouchers', label: 'Vouchers', icon: Ticket, permission: 'vouchers' },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree, permission: 'categories' },
      { to: '/admin/homepage', label: 'Homepage', icon: House, permission: 'homepage' },
      { to: '/admin/marketplace-editor', label: 'Marketplace Slideshow', icon: GalleryHorizontal, permission: 'homepage' },
      { to: '/admin/registrations', label: 'Registration Calendar', icon: CalendarDays, permission: 'registrations' },
      { to: '/admin/reviews', label: 'Reviews & Ratings', icon: Star, permission: 'reviews' }
    ]
  },
  {
    label: 'Communication',
    items: [
      { to: '/admin/chats', label: 'Chat History', icon: MessageSquare, permission: 'chats' },
      { to: '/admin/support-chats', label: 'Support Chats', icon: LifeBuoy, permission: 'support' }
    ]
  },
  {
    label: 'Platform Config',
    items: [
      { to: '/admin/delivery-providers', label: 'Delivery Providers', icon: Truck, adminOnly: true },
      { to: '/admin/shipping-pricing', label: 'Shipping & Order Fees', icon: Milestone, adminOnly: true },
      { to: '/admin/integrations', label: 'Integrations', icon: Plug, adminOnly: true },
      { to: '/admin/legal', label: 'Legal Settings', icon: Scale, adminOnly: true }
    ]
  },
  {
    label: 'People & Access',
    items: [
      { to: '/admin/activity-log', label: 'Activity Audit', icon: Activity, adminOnly: true },
      { to: '/admin/full-access', label: 'Full Access', icon: KeyRound, adminOnly: true },
      { to: '/admin/login-history', label: 'Login History', icon: History, permission: 'login_history' },
      { to: '/admin/staff', label: 'Staff Access', icon: UserCog, adminOnly: true },
      { to: '/admin/test-accounts', label: 'Test Accounts', icon: Bug, adminOnly: true }
    ]
  },
  {
    label: 'Docs & Reference',
    items: [
      { to: '/admin/merchant-presentation', label: 'Merchant Slides', icon: Presentation, adminOnly: true },
      { to: '/admin/process-guide', label: 'Process Guide', icon: BookOpenCheck, adminOnly: true },
      { to: '/admin/reseller-presentation', label: 'Reseller Slides', icon: Presentation, adminOnly: true },
      { to: '/admin/system-flowchart', label: 'System Flowchart', icon: Workflow, adminOnly: true }
    ]
  }
]

function Sidebar({ open, collapsed, onClose, onToggleCollapse, visibleSections, currentPath, theme }) {
  return (
    <>
      {open && <button type="button" aria-label="Close admin navigation" onClick={onClose} className="fixed inset-x-0 bottom-0 top-16 z-40 bg-scrim/40 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed bottom-0 left-0 top-16 z-50 flex w-[min(19rem,calc(100vw-1.5rem))] flex-col border-r border-line bg-surface text-fg shadow-2xl transition-transform duration-300 lg:sticky lg:z-20 lg:h-[calc(100vh-4rem)] lg:shrink-0 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-[84px]' : 'lg:w-64'}`}>
        <div className={`flex h-[76px] shrink-0 items-center border-b border-line ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
          {!collapsed ? <div className="min-w-0"><img src={theme === 'dark' ? '/rmhub-logo-dark.svg' : '/rmhub-logo.svg'} alt="JOM HUB" className="h-9 w-auto" /><p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted"><ShieldCheck size={13} className="text-mango-600" /> Admin Center</p></div> : <img src="/rmhub-mark.svg" alt="JOM HUB" className="h-10 w-10" />}
          <button onClick={onClose} className="rounded-xl p-2 text-fg-muted hover:bg-teal-100 hover:text-teal-900 dark:hover:bg-teal-500/15 dark:hover:text-teal-200 lg:hidden" aria-label="Close menu"><X size={20} /></button>
          <button onClick={onToggleCollapse} className="hidden rounded-xl p-2 text-fg-muted hover:bg-teal-100 hover:text-teal-900 dark:hover:bg-teal-500/15 dark:hover:text-teal-200 lg:block" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><PanelLeftClose size={19} className={collapsed ? 'rotate-180' : ''} /></button>
        </div>

        <SidebarNav sections={visibleSections} collapsed={collapsed} currentPath={currentPath} onNavigate={onClose} />

        {!collapsed && <div className="shrink-0 border-t border-line p-4"><div className="rounded-xl bg-surface-inset px-3 py-3"><p className="text-xs font-semibold text-teal-900 dark:text-teal-200">Secure admin area</p><p className="mt-0.5 text-[11px] leading-4 text-fg-muted">Review payments and account requests carefully.</p></div></div>}
      </aside>
    </>
  )
}

export default function AdminLayout() {
  const { profile } = useAuth()
  const { theme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const visibleSections = sections.map((section) => ({ ...section, items: section.items.filter((item) => item.adminOnly ? profile?.role === 'admin' : !item.permission || canAccessAdmin(profile, item.permission)) })).filter((section) => section.items.length)
  const currentItem = visibleSections.flatMap((section) => section.items).find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))
  return (
    <div className="workspace-luxe min-h-[calc(100vh-4rem)] lg:flex">
      <Sidebar open={menuOpen} collapsed={collapsed} onClose={() => setMenuOpen(false)} onToggleCollapse={() => setCollapsed((value) => !value)} visibleSections={visibleSections} currentPath={location.pathname} theme={theme} />
      <section className="workspace-background min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-5 lg:px-8">
          <button onClick={() => setMenuOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10 lg:hidden"><Menu size={19} /><span className="hidden sm:inline">Menu</span></button>
          <div className="hidden min-w-0 flex-1 lg:block"><p className="truncate text-sm font-semibold text-fg">{currentItem?.label || 'Admin'}</p><p className="text-[11px] text-fg-muted">Admin Center</p></div>
          <div className="min-w-0 flex-1 lg:hidden"><p className="truncate text-sm font-semibold text-fg">{currentItem?.label || 'Admin'}</p></div>
          <div className="hidden shrink-0 md:block"><CommandPalette sections={visibleSections} /></div>
          <div className="flex shrink-0 items-center gap-2"><InteractivePageGuide /><AdminNotifications /></div>
        </div>
        <main className="min-w-0" data-guide-main><Outlet /></main>
      </section>
    </div>
  )
}
