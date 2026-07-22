import { BarChart3, Boxes, ClipboardList, FileDown, FileUp, LayoutDashboard, MapPin, Megaphone, MessageSquare, Package, ShoppingBag, Star, WalletCards } from 'lucide-react'
import WorkspaceLayout from '../../components/layout/WorkspaceLayout'
import SubscriptionExpiryModal from '../../components/merchant/SubscriptionExpiryModal'
import RoleGuide from '../../components/onboarding/RoleGuide'
import RoleNotifications from '../../components/notifications/RoleNotifications'

const sections = [
  { label: 'Store Management', items: [
    { to: '/merchant', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/merchant/products', label: 'Products', icon: Package },
    { to: '/merchant/reviews', label: 'Reviews & Ratings', icon: Star },
    { to: '/merchant/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/merchant/orders', label: 'Customer Orders', icon: ClipboardList },
    { to: '/merchant/purchases', label: 'My Purchases', icon: ShoppingBag },
    { to: '/merchant/chats', label: 'Messages', icon: MessageSquare },
    { to: '/merchant/wallet', label: 'Wallet', icon: WalletCards },
    { to: '/merchant/address', label: 'Pickup Address', icon: MapPin }
  ]},
  { label: 'Reports', items: [
    { to: '/merchant/reports/sales', label: 'Sales Report', icon: BarChart3 },
    { to: '/merchant/reports/inventory', label: 'Inventory Report', icon: Boxes },
    { to: '/merchant/reports/topups', label: 'Top-Up Report', icon: FileUp },
    { to: '/merchant/reports/withdrawals', label: 'Withdrawal Report', icon: FileDown },
    { to: '/merchant/reports/ordered', label: 'Ordered Report', icon: ClipboardList }
  ]}
]
export default function MerchantLayout() { return <WorkspaceLayout title="Merchant Hub" subtitle="Store workspace" sections={sections}><RoleNotifications /><SubscriptionExpiryModal /><RoleGuide /></WorkspaceLayout> }
