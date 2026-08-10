import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AlertCircle, ClipboardList, House, Menu, Package, PanelLeftClose, Handshake, Store, WalletCards, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isCompleteAddress } from '../../utils/address'
import RoleNotifications from '../notifications/RoleNotifications'
import InteractivePageGuide from '../onboarding/InteractivePageGuide'
import JomBits from '../assistant/JomBits'
import CommandPalette from '../ui/CommandPalette'
import SidebarNav from './SidebarNav'

export default function WorkspaceLayout({ title, subtitle, sections, children }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { profile, role } = useAuth()
  useEffect(() => { setOpen(false) }, [location.pathname])
  const items = sections.flatMap((section) => section.items)
  const current = items.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))
  const address = role === 'merchant' ? profile?.merchant_profiles?.business_address : profile?.address
  const needsAddress = (role === 'merchant' || role === 'reseller') && !isCompleteAddress(address)
  const mobileItems = role === 'merchant' ? [
    {to:'/merchant',label:'Home',icon:House},{to:'/merchant/products',label:'Products',icon:Package},{to:'/merchant/orders',label:'Orders',icon:ClipboardList},{to:'/merchant/wallet',label:'Wallet',icon:WalletCards},{to:'/merchant/referrals',label:'Referrals',icon:Handshake}
  ] : [
    {to:'/reseller',label:'Home',icon:House},{to:'/catalog',label:'Products',icon:Package},{to:'/reseller/orders',label:'Orders',icon:ClipboardList},{to:'/reseller/wallet',label:'Wallet',icon:WalletCards},{to:'/reseller/referrals',label:'Referrals',icon:Handshake}
  ]

  return <div className="min-h-[calc(100vh-4rem)] lg:flex">
    {open && <button onClick={() => setOpen(false)} aria-label="Close navigation" className="fixed inset-x-0 bottom-0 top-16 z-40 bg-scrim/40 backdrop-blur-sm lg:hidden" />}
    <aside className={`fixed bottom-0 left-0 top-16 z-50 flex w-[min(19rem,calc(100vw-1.5rem))] flex-col border-r border-line bg-surface shadow-2xl transition-transform duration-300 lg:sticky lg:z-20 lg:h-[calc(100vh-4rem)] lg:shrink-0 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-[84px]' : 'lg:w-64'}`}>
      <div className={`flex h-[76px] shrink-0 items-center border-b border-line bg-teal-50 dark:bg-teal-500/10 ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
        {!collapsed && <div className="min-w-0"><div className="flex items-center gap-2 font-display font-bold text-teal-900 dark:text-teal-200"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white"><Store size={17} /></span><span className="truncate">{title}</span></div><p className="ml-10 mt-0.5 text-xs text-fg-muted">{subtitle}</p></div>}
        <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-fg-muted hover:bg-teal-100 dark:hover:bg-teal-500/15 lg:hidden"><X size={20} /></button>
        <button onClick={() => setCollapsed((value) => !value)} className="hidden rounded-xl p-2 text-fg-muted hover:bg-teal-100 dark:hover:bg-teal-500/15 lg:block"><PanelLeftClose size={19} className={collapsed ? 'rotate-180' : ''} /></button>
      </div>

      <SidebarNav sections={sections} collapsed={collapsed} currentPath={location.pathname} onNavigate={() => setOpen(false)} />

      {!collapsed && <div className="shrink-0 border-t border-line p-4"><div className="rounded-xl bg-surface-inset px-3 py-3 text-xs leading-5 text-fg-muted">Secure workspace for your account activity and reports.</div></div>}
    </aside>
    <section className="workspace-background min-w-0 flex-1 pb-20 lg:pb-0">
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-5 lg:px-8">
        <button onClick={() => setOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10 lg:hidden"><Menu size={19} /><span className="hidden sm:inline">Menu</span></button>
        <div className="hidden min-w-0 flex-1 lg:block"><p className="truncate text-sm font-semibold text-fg">{current?.label || title}</p><p className="text-[11px] text-fg-muted">{role === 'merchant' ? 'Merchant workspace' : 'Reseller workspace'}</p></div>
        <div className="min-w-0 flex-1 lg:hidden"><p className="truncate text-sm font-semibold text-fg">{current?.label || title}</p></div>
        <div className="hidden shrink-0 md:block"><CommandPalette sections={sections} /></div>
        <div className="flex shrink-0 items-center gap-2"><InteractivePageGuide/><RoleNotifications/></div>
      </div>
      {needsAddress && <div className="mx-4 mt-4 flex flex-col gap-3 rounded-2xl border border-mango-300 bg-mango-100/70 p-4 text-sm dark:border-mango-700 dark:bg-mango-500/10 sm:mx-6 sm:flex-row sm:items-center sm:justify-between lg:mx-8"><div className="flex items-start gap-3"><AlertCircle size={19} className="mt-0.5 shrink-0 text-mango-600" /><div><p className="font-semibold text-fg">Complete your address to unlock all features</p><p className="mt-0.5 text-xs leading-5 text-fg-muted">A complete address is required for products, customers, and orders.</p></div></div><Link to={role === 'merchant' ? '/merchant/address' : '/reseller/address'} className="btn-secondary shrink-0 px-4 py-2 text-center text-xs">Complete address</Link></div>}
      {children}
      <main className="min-w-0" data-guide-main><Outlet /></main>
      <JomBits workspace />
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-line bg-surface/95 px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_24px_rgba(3,33,22,.08)] backdrop-blur lg:hidden" aria-label={`${role} mobile navigation`}>{mobileItems.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={label==='Home'} className={({isActive})=>`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${isActive?'bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300':'text-fg-muted'}`}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
    </section>
  </div>
}
