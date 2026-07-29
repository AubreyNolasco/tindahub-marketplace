import { BarChart3, Boxes, ClipboardList, FileDown, FileUp, LayoutDashboard, MapPin, MessageSquare, Store, Handshake, Send, UserRound, Users, WalletCards, Truck } from 'lucide-react'
import WorkspaceLayout from '../../components/layout/WorkspaceLayout'

const sections = [
  { label: 'Workspace', items: [
    { to: '/reseller', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/reseller/orders', label: 'Orders', icon: ClipboardList },
    { to: '/reseller/products', label: 'My Product List', icon: Store },
    { to: '/reseller/customers', label: 'Customers', icon: Users },
    { to: '/reseller/chats', label: 'Messages', icon: MessageSquare },
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
export default function ResellerLayout() { return <WorkspaceLayout title="Reseller Hub" subtitle="Sales workspace" sections={sections} /> }
