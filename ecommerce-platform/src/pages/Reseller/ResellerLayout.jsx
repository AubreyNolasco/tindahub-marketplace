import { useEffect, useState } from 'react'
import { BarChart3, Boxes, ClipboardList, FileDown, FileUp, Inbox, LayoutDashboard, LifeBuoy, MapPin, MessageSquare, Store, Handshake, Send, UserRound, Users, WalletCards, Truck } from 'lucide-react'
import WorkspaceLayout from '../../components/layout/WorkspaceLayout'
import RestrictedAccountBanner from '../../components/dashboard/RestrictedAccountBanner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const buildSections = (pendingRequestCount) => [
  { label: 'Workspace', items: [
    { to: '/reseller', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/reseller/orders', label: 'Orders', icon: ClipboardList },
    { to: '/reseller/products', label: 'My Product List', icon: Store },
    { to: '/reseller/order-requests', label: 'Customer Orders', icon: Inbox, badge: pendingRequestCount },
    { to: '/reseller/customers', label: 'Customers', icon: Users },
    { to: '/reseller/chats', label: 'Messages', icon: MessageSquare },
    { to: '/reseller/support', label: 'Chat Support', icon: LifeBuoy },
    { to: '/reseller/wallet', label: 'Wallet', icon: WalletCards },
    { to: '/reseller/delivery', label: 'Delivery Settings', icon: Truck },
    { to: '/reseller/address', label: 'My Address', icon: MapPin },
    { to: '/reseller/account', label: 'Update Account', icon: UserRound }
  ]},
  { label: 'Service Referrals', items: [
    { to: '/clinics', label: 'Browse Services', icon: Handshake },
    { to: '/reseller/referrals', label: 'My Referrals', icon: Send }
  ]},
  { label: 'Reports', items: [
    { to: '/reseller/reports/sales', label: 'Sales Report', icon: BarChart3 },
    { to: '/reseller/reports/inventory', label: 'Inventory Report', icon: Boxes },
    { to: '/reseller/reports/topups', label: 'Top-Up Report', icon: FileUp },
    { to: '/reseller/reports/withdrawals', label: 'Withdrawal Report', icon: FileDown },
    { to: '/reseller/reports/ordered', label: 'Ordered Report', icon: ClipboardList }
  ]}
]

export default function ResellerLayout() {
  const { user } = useAuth()
  const [pendingRequestCount, setPendingRequestCount] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase
      .from('storefront_order_requests')
      .select('id', { count: 'exact', head: true })
      .eq('reseller_id', user.id)
      .eq('status', 'pending')
      .then(({ count }) => setPendingRequestCount(count || 0))
  }, [user])

  return <WorkspaceLayout title="Reseller Hub" subtitle="Sales workspace" sections={buildSections(pendingRequestCount)}><RestrictedAccountBanner /></WorkspaceLayout>
}
