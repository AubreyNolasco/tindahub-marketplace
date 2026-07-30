import { BarChart3, Boxes, ClipboardList, FileDown, FileUp, LayoutDashboard, LifeBuoy, MapPin, Megaphone, MessageSquare, Package, ShoppingBag, Star, Handshake, UserRound, WalletCards, UserPlus, Sliders } from 'lucide-react'
import WorkspaceLayout from '../../components/layout/WorkspaceLayout'
import SubscriptionExpiryModal from '../../components/merchant/SubscriptionExpiryModal'
import RestrictedAccountBanner from '../../components/dashboard/RestrictedAccountBanner'

const sections = [
  { label: 'Store Management', items: [
    { to: '/merchant', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/merchant/products', label: 'Products', icon: Package },
    { to: '/merchant/reviews', label: 'Reviews & Ratings', icon: Star },
    { to: '/merchant/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/merchant/orders', label: 'Customer Orders', icon: ClipboardList },
    { to: '/merchant/purchases', label: 'My Purchases', icon: ShoppingBag },
    { to: '/merchant/chats', label: 'Messages', icon: MessageSquare },
    { to: '/merchant/support', label: 'Chat Support', icon: LifeBuoy },
    { to: '/merchant/wallet', label: 'Wallet', icon: WalletCards },
    { to: '/merchant/address', label: 'Pickup Address', icon: MapPin },
    { to: '/merchant/account', label: 'Update Account', icon: UserRound }
  ]},
  { label: 'Service Referrals', items: [
    { to: '/merchant/service-settings', label: 'Service Type', icon: Sliders },
    { to: '/merchant/clinic-services', label: 'Manage Services', icon: Handshake },
    { to: '/merchant/referrals', label: 'Referral Requests', icon: UserPlus }
  ]},
  { label: 'Reports', items: [
    { to: '/merchant/reports/sales', label: 'Sales Report', icon: BarChart3 },
    { to: '/merchant/reports/inventory', label: 'Inventory Report', icon: Boxes },
    { to: '/merchant/reports/topups', label: 'Top-Up Report', icon: FileUp },
    { to: '/merchant/reports/withdrawals', label: 'Withdrawal Report', icon: FileDown },
    { to: '/merchant/reports/ordered', label: 'Ordered Report', icon: ClipboardList }
  ]}
]
export default function MerchantLayout() { return <WorkspaceLayout title="Merchant Hub" subtitle="Store workspace" sections={sections}><SubscriptionExpiryModal /><RestrictedAccountBanner /></WorkspaceLayout> }
