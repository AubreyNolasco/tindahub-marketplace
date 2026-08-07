import { BarChart3, Boxes, ClipboardList, FileDown, FileUp, LayoutDashboard, LifeBuoy, MapPin, Megaphone, MessageSquare, Package, ShoppingBag, Star, Handshake, UserRound, WalletCards, UserPlus, Sliders, Truck, Ticket } from 'lucide-react'
import WorkspaceLayout from '../../components/layout/WorkspaceLayout'
import SubscriptionExpiryModal from '../../components/merchant/SubscriptionExpiryModal'
import RestrictedAccountBanner from '../../components/dashboard/RestrictedAccountBanner'

const sections = [
  { label: 'Overview', items: [
    { to: '/merchant', label: 'Overview', icon: LayoutDashboard, end: true }
  ]},
  { label: 'Store', items: [
    { to: '/merchant/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/merchant/vouchers', label: 'Vouchers', icon: Ticket },
    { to: '/merchant/orders', label: 'Customer Orders', icon: ClipboardList },
    { to: '/merchant/purchases', label: 'My Purchases', icon: ShoppingBag },
    { to: '/merchant/products', label: 'Products', icon: Package },
    { to: '/merchant/reviews', label: 'Reviews & Ratings', icon: Star }
  ]},
  { label: 'Account & Support', items: [
    { to: '/merchant/support', label: 'Chat Support', icon: LifeBuoy },
    { to: '/merchant/delivery', label: 'Delivery Settings', icon: Truck },
    { to: '/merchant/chats', label: 'Messages', icon: MessageSquare },
    { to: '/merchant/address', label: 'Pickup Address', icon: MapPin },
    { to: '/merchant/account', label: 'Update Account', icon: UserRound },
    { to: '/merchant/wallet', label: 'Wallet', icon: WalletCards }
  ]},
  { label: 'Service Referrals', items: [
    { to: '/merchant/clinic-services', label: 'Manage Services', icon: Handshake },
    { to: '/merchant/referrals', label: 'Referral Requests', icon: UserPlus },
    { to: '/merchant/service-settings', label: 'Service Type', icon: Sliders }
  ]},
  { label: 'Reports', items: [
    { to: '/merchant/reports/inventory', label: 'Inventory Report', icon: Boxes },
    { to: '/merchant/reports/ordered', label: 'Ordered Report', icon: ClipboardList },
    { to: '/merchant/reports/sales', label: 'Sales Report', icon: BarChart3 },
    { to: '/merchant/reports/topups', label: 'Top-Up Report', icon: FileUp },
    { to: '/merchant/reports/withdrawals', label: 'Withdrawal Report', icon: FileDown }
  ]}
]
export default function MerchantLayout() { return <WorkspaceLayout title="Merchant Hub" subtitle="Store workspace" sections={sections}><SubscriptionExpiryModal /><RestrictedAccountBanner /></WorkspaceLayout> }
