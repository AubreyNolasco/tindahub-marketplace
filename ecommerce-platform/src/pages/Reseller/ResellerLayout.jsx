import { BarChart3, Boxes, ClipboardList, FileDown, FileUp, LayoutDashboard, MapPin, MessageSquare, UserRound, Users, WalletCards } from 'lucide-react'
import WorkspaceLayout from '../../components/layout/WorkspaceLayout'

const sections = [
  { label: 'Workspace', items: [
    { to: '/reseller', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/reseller/orders', label: 'Orders', icon: ClipboardList },
    { to: '/reseller/customers', label: 'Customers', icon: Users },
    { to: '/reseller/chats', label: 'Messages', icon: MessageSquare },
    { to: '/reseller/wallet', label: 'Wallet', icon: WalletCards },
    { to: '/reseller/address', label: 'My Address', icon: MapPin },
    { to: '/reseller/account', label: 'Update Account', icon: UserRound }
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
