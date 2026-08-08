import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import ProtectedRoute from './components/layout/ProtectedRoute'
import NetworkStatus from './components/system/NetworkStatus'
import ScrollToTop from './components/system/ScrollToTop'
import PostLoginGuide from './components/onboarding/PostLoginGuide'
import DeviceAccessGuard from './components/auth/DeviceAccessGuard'
import MfaGuard from './components/auth/MfaGuard'
import DemoModeBanner from './components/system/DemoModeBanner'
import AdminPermissionRoute from './components/auth/AdminPermissionRoute'
import Spinner from './components/ui/Spinner'

// Route-level code splitting: every page below loads on demand instead
// of being bundled into one of three giant Admin/Merchant/Reseller
// chunks. That path-based grouping (see vite.config.js history) is what
// caused the circular-chunk warnings and the 665KB reseller-pages
// bundle — pages in different sections import each other's components,
// so Rollup couldn't split them cleanly. Per-route lazy() lets Rollup
// split along the real import graph instead.
const Home = lazy(() => import('./pages/Home'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Catalog = lazy(() => import('./pages/Catalog'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const MerchantStore = lazy(() => import('./pages/MerchantStore'))
const Policy = lazy(() => import('./pages/Policy'))
const Login = lazy(() => import('./pages/Auth/Login'))
const PendingApproval = lazy(() => import('./pages/Auth/PendingApproval'))
const SubscriptionLocked = lazy(() => import('./pages/Merchant/SubscriptionLocked'))
const ChooseSubscription = lazy(() => import('./pages/Auth/ChooseSubscription'))
const AuthCallback = lazy(() => import('./pages/Auth/AuthCallback'))
const AuthContinue = lazy(() => import('./pages/Auth/AuthContinue'))
const Onboarding = lazy(() => import('./pages/Auth/Onboarding'))
const DeviceAccessAction = lazy(() => import('./pages/Auth/DeviceAccessAction'))

const ResellerLayout = lazy(() => import('./pages/Reseller/ResellerLayout'))
const ResellerDashboard = lazy(() => import('./pages/Reseller/ResellerDashboard'))
const Cart = lazy(() => import('./pages/Reseller/Cart'))
const Checkout = lazy(() => import('./pages/Reseller/Checkout'))
const OrderHistory = lazy(() => import('./pages/Reseller/OrderHistory'))
const Customers = lazy(() => import('./pages/Reseller/Customers'))
const ResellerWallet = lazy(() => import('./pages/Reseller/WalletPage'))
const ResellerChats = lazy(() => import('./pages/Reseller/Chats'))
const ResellerChatDetail = lazy(() => import('./pages/Reseller/ChatDetail'))
const ResellerSalesReport = lazy(() => import('./pages/Reseller/Reports/SalesReport'))
const ResellerInventoryReport = lazy(() => import('./pages/Reseller/Reports/InventoryReport'))
const ResellerTopupReport = lazy(() => import('./pages/Reseller/Reports/TopupReport'))
const ResellerWithdrawalReport = lazy(() => import('./pages/Reseller/Reports/WithdrawalReport'))
const ResellerOrderedReport = lazy(() => import('./pages/Reseller/Reports/OrderedReport'))
const StorefrontProducts = lazy(() => import('./pages/Reseller/StorefrontProducts'))
const ResellerStorefront = lazy(() => import('./pages/ResellerStorefront'))
const ClinicDiscovery = lazy(() => import('./pages/Reseller/ClinicDiscovery'))
const MyReferrals = lazy(() => import('./pages/Reseller/MyReferrals'))
const StorefrontOrderRequests = lazy(() => import('./pages/Reseller/StorefrontOrderRequests'))
const DeliverySettings = lazy(() => import('./pages/Reseller/DeliverySettings'))
const IdVerification = lazy(() => import('./pages/Reseller/IdVerification'))

const MerchantLayout = lazy(() => import('./pages/Merchant/MerchantLayout'))
const ServiceSettings = lazy(() => import('./pages/Merchant/ServiceSettings'))
const ClinicServices = lazy(() => import('./pages/Merchant/ClinicServices'))
const ReferralRequests = lazy(() => import('./pages/Merchant/ReferralRequests'))
const MerchantDashboard = lazy(() => import('./pages/Merchant/MerchantDashboard'))
const Products = lazy(() => import('./pages/Merchant/Products'))
const ProductForm = lazy(() => import('./pages/Merchant/ProductForm'))
const Orders = lazy(() => import('./pages/Merchant/Orders'))
const WalletPage = lazy(() => import('./pages/Merchant/WalletPage'))
const Purchases = lazy(() => import('./pages/Merchant/Purchases'))
const MerchantChats = lazy(() => import('./pages/Merchant/Chats'))
const MerchantChatDetail = lazy(() => import('./pages/Merchant/ChatDetail'))
const MerchantSalesReport = lazy(() => import('./pages/Merchant/Reports/SalesReport'))
const MerchantInventoryReport = lazy(() => import('./pages/Merchant/Reports/InventoryReport'))
const MerchantTopupReport = lazy(() => import('./pages/Merchant/Reports/TopupReport'))
const MerchantWithdrawalReport = lazy(() => import('./pages/Merchant/Reports/WithdrawalReport'))
const MerchantOrderedReport = lazy(() => import('./pages/Merchant/Reports/OrderedReport'))

const AdminLayout = lazy(() => import('./pages/Admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'))
const Merchants = lazy(() => import('./pages/Admin/Merchants'))
const MerchantFollowups = lazy(() => import('./pages/Admin/MerchantFollowups'))
const SupportChats = lazy(() => import('./pages/Admin/SupportChats'))
const MerchantSupportChat = lazy(() => import('./pages/Merchant/SupportChat'))
const ResellerSupportChat = lazy(() => import('./pages/Reseller/SupportChat'))
const Payments = lazy(() => import('./pages/Admin/Payments'))
const TopupRequests = lazy(() => import('./pages/Admin/TopupRequests'))
const WithdrawalRequests = lazy(() => import('./pages/Admin/WithdrawalRequests'))
const ChatHistory = lazy(() => import('./pages/Admin/ChatHistory'))
const ChatHistoryDetail = lazy(() => import('./pages/Admin/ChatHistoryDetail'))
const Categories = lazy(() => import('./pages/Admin/Categories'))
const Subscriptions = lazy(() => import('./pages/Admin/Subscriptions'))
const HomepageEditor = lazy(() => import('./pages/Admin/HomepageEditor'))
const ProcessPresentation = lazy(() => import('./pages/Admin/ProcessPresentation'))
const AdminWallet = lazy(() => import('./pages/Admin/Wallet'))
const Sales = lazy(() => import('./pages/Admin/Sales'))
const AdminSalesReport = lazy(() => import('./pages/Admin/Reports/SalesReport'))
const AdminInventoryReport = lazy(() => import('./pages/Admin/Reports/InventoryReport'))
const AdminTopupReport = lazy(() => import('./pages/Admin/Reports/TopupReport'))
const AdminWithdrawalReport = lazy(() => import('./pages/Admin/Reports/WithdrawalReport'))
const AdminOrderedReport = lazy(() => import('./pages/Admin/Reports/OrderedReport'))
const LoginHistory = lazy(() => import('./pages/Admin/LoginHistory'))
const ReviewsManagement = lazy(() => import('./pages/ReviewsManagement'))
const AdminCampaigns = lazy(() => import('./pages/Admin/Campaigns'))
const MerchantCampaigns = lazy(() => import('./pages/Merchant/Campaigns'))
const AdminVouchers = lazy(() => import('./pages/Admin/Vouchers'))
const MerchantVouchers = lazy(() => import('./pages/Merchant/Vouchers'))
const AdminCampaignPerformanceReport = lazy(() => import('./pages/Admin/Reports/CampaignPerformanceReport'))
const ProfileAddress = lazy(() => import('./pages/ProfileAddress'))
const AccountSettings = lazy(() => import('./pages/AccountSettings'))
const AdminRegistrations = lazy(() => import('./pages/Admin/Registrations'))
const BusinessPermit = lazy(() => import('./pages/Merchant/BusinessPermit'))
const StaffManagement = lazy(() => import('./pages/Admin/StaffManagement'))
const AdminDeliveryProviders = lazy(() => import('./pages/Admin/DeliveryProviders'))
const MerchantDeliverySettings = lazy(() => import('./pages/Merchant/DeliverySettings'))
const LegalSettings = lazy(() => import('./pages/Admin/LegalSettings'))
const ProcessGuide = lazy(() => import('./pages/Admin/ProcessGuide'))
const SystemFlowchart = lazy(() => import('./pages/Admin/SystemFlowchart'))
const FullSystemFlowchart = lazy(() => import('./pages/Admin/FullSystemFlowchart'))
const AdminFullAccess = lazy(() => import('./pages/Admin/FullAccess'))
const ApprovalCenter = lazy(() => import('./pages/Admin/ApprovalCenter'))
const OrderCases = lazy(() => import('./pages/Admin/OrderCases'))
const ActivityLog = lazy(() => import('./pages/Admin/ActivityLog'))
const TestAccounts = lazy(() => import('./pages/Admin/TestAccounts'))
const ResellerVerifications = lazy(() => import('./pages/Admin/ResellerVerifications'))
const Integrations = lazy(() => import('./pages/Admin/Integrations'))

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <NetworkStatus />
      <AuthProvider>
        <CartProvider>
          <PostLoginGuide />
          <MfaGuard />
          <DeviceAccessGuard />
          <div className="min-h-screen bg-bg flex flex-col">
            <Navbar />
            <DemoModeBanner />
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: '#16211E',
                  color: '#FBF9F4',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1rem'
                },
                success: { iconTheme: { primary: '#16794B', secondary: '#F7FAF7' } },
                error: { iconTheme: { primary: '#E4572E', secondary: '#FBF9F4' } }
              }}
            />
            <main className="flex-1">
              <Suspense fallback={<div className="flex justify-center py-24"><Spinner /></div>}>
              <Routes>
<Route path="/" element={<Home />} />
                <Route path="/catalog" element={<ProtectedRoute allowedRoles={['reseller','merchant','admin','staff']}><Catalog /></ProtectedRoute>} />
                <Route path="/marketplace" element={<ProtectedRoute allowedRoles={['reseller','merchant','admin','staff']}><Marketplace /></ProtectedRoute>} />
                <Route path="/product/:id" element={<ProtectedRoute allowedRoles={['reseller','merchant','admin','staff']}><ProductDetail /></ProtectedRoute>} />
                <Route path="/merchant-store/:id" element={<ProtectedRoute allowedRoles={['reseller','merchant','admin','staff']}><MerchantStore /></ProtectedRoute>} />
                <Route path="/reseller-store/:id" element={<ResellerStorefront />} />
                <Route path="/store/:slug" element={<ResellerStorefront />} />
                <Route path="/policy" element={<Policy />} />
                <Route path="/legal/:type" element={<Policy />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/continue" element={<AuthContinue />} />
                <Route path="/device-access" element={<DeviceAccessAction />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/subscription-locked" element={<SubscriptionLocked />} />
                <Route path="/choose-subscription" element={<ChooseSubscription />} />
                <Route path="/merchant-permit" element={<ProtectedRoute allowedRoles={['merchant']}><BusinessPermit /></ProtectedRoute>} />
                <Route path="/verify-id" element={<IdVerification />} />
                <Route path="/clinics" element={<ProtectedRoute allowedRoles={['reseller','merchant','admin']}><ClinicDiscovery /></ProtectedRoute>} />

                {/* Reseller */}
                <Route path="/cart" element={<ProtectedRoute allowedRoles={['reseller', 'merchant']}><Cart /></ProtectedRoute>} />
                <Route path="/checkout/:merchantId" element={<ProtectedRoute allowedRoles={['reseller', 'merchant']}><Checkout /></ProtectedRoute>} />
                <Route path="/reseller" element={<ProtectedRoute allowedRoles={['reseller']}><ResellerLayout /></ProtectedRoute>}>
                  <Route index element={<ResellerDashboard />} />
                  <Route path="orders" element={<OrderHistory />} />
                  <Route path="products" element={<StorefrontProducts />} />
                  <Route path="order-requests" element={<StorefrontOrderRequests />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="chats" element={<ResellerChats />} />
                  <Route path="chats/:merchantId" element={<ResellerChatDetail />} />
                  <Route path="support" element={<ResellerSupportChat />} />
<Route path="wallet" element={<ResellerWallet />} />
                  <Route path="delivery" element={<DeliverySettings />} />
                  <Route path="address" element={<ProfileAddress />} />
                  <Route path="account" element={<AccountSettings />} />
                  <Route path="reports/sales" element={<ResellerSalesReport />} />
                  <Route path="reports/inventory" element={<ResellerInventoryReport />} />
                  <Route path="reports/topups" element={<ResellerTopupReport />} />
                  <Route path="reports/withdrawals" element={<ResellerWithdrawalReport />} />
                  <Route path="reports/ordered" element={<ResellerOrderedReport />} />
                  <Route path="referrals" element={<MyReferrals />} />
                </Route>

                {/* Merchant */}
                <Route path="/merchant" element={<ProtectedRoute allowedRoles={['merchant']}><MerchantLayout /></ProtectedRoute>}>
                  <Route index element={<MerchantDashboard />} />
                  <Route path="products" element={<Products />} />
                  <Route path="products/new" element={<ProductForm />} />
                  <Route path="products/:id/edit" element={<ProductForm />} />
                  <Route path="reviews" element={<ReviewsManagement />} />
                  <Route path="campaigns" element={<MerchantCampaigns />} />
                  <Route path="vouchers" element={<MerchantVouchers />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="purchases" element={<Purchases />} />
                  <Route path="chats" element={<MerchantChats />} />
                  <Route path="chats/:resellerId" element={<MerchantChatDetail />} />
                  <Route path="support" element={<MerchantSupportChat />} />
                  <Route path="wallet" element={<WalletPage />} />
                  <Route path="delivery" element={<MerchantDeliverySettings />} />
                  <Route path="address" element={<ProfileAddress merchant />} />
                  <Route path="account" element={<AccountSettings merchant />} />
                  <Route path="reports/sales" element={<MerchantSalesReport />} />
                  <Route path="reports/inventory" element={<MerchantInventoryReport />} />
                  <Route path="reports/topups" element={<MerchantTopupReport />} />
                  <Route path="reports/withdrawals" element={<MerchantWithdrawalReport />} />
                  <Route path="reports/ordered" element={<MerchantOrderedReport />} />
                  <Route path="service-settings" element={<ServiceSettings />} />
                  <Route path="clinic-services" element={<ClinicServices />} />
                  <Route path="referrals" element={<ReferralRequests />} />
                </Route>

                {/* Admin */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminLayout /></ProtectedRoute>}>
                  <Route index element={<AdminPermissionRoute permission="overview"><AdminDashboard /></AdminPermissionRoute>} />
                  <Route path="staff" element={<AdminPermissionRoute adminOnly><StaffManagement /></AdminPermissionRoute>} />
                  <Route path="full-access" element={<AdminPermissionRoute adminOnly><AdminFullAccess /></AdminPermissionRoute>} />
                  <Route path="approval-center" element={<AdminPermissionRoute adminOnly><ApprovalCenter /></AdminPermissionRoute>} />
                  <Route path="reseller-verifications" element={<AdminPermissionRoute adminOnly><ResellerVerifications /></AdminPermissionRoute>} />
                  <Route path="order-cases" element={<AdminPermissionRoute adminOnly><OrderCases /></AdminPermissionRoute>} />
                  <Route path="activity-log" element={<AdminPermissionRoute adminOnly><ActivityLog /></AdminPermissionRoute>} />
                  <Route path="test-accounts" element={<AdminPermissionRoute adminOnly><TestAccounts /></AdminPermissionRoute>} />
                  <Route path="products" element={<AdminPermissionRoute adminOnly><Products admin /></AdminPermissionRoute>} />
                  <Route path="products/new" element={<AdminPermissionRoute adminOnly><ProductForm admin /></AdminPermissionRoute>} />
                  <Route path="products/:id/edit" element={<AdminPermissionRoute adminOnly><ProductForm admin /></AdminPermissionRoute>} />
                  <Route path="legal" element={<AdminPermissionRoute adminOnly><LegalSettings /></AdminPermissionRoute>} />
                  <Route path="delivery-providers" element={<AdminPermissionRoute adminOnly><AdminDeliveryProviders /></AdminPermissionRoute>} />
                  <Route path="integrations" element={<AdminPermissionRoute adminOnly><Integrations /></AdminPermissionRoute>} />
                  <Route path="system-flowchart" element={<AdminPermissionRoute adminOnly><SystemFlowchart /></AdminPermissionRoute>} />
                  <Route path="system-flowchart/full" element={<AdminPermissionRoute adminOnly><FullSystemFlowchart /></AdminPermissionRoute>} />
                  <Route path="process-guide" element={<AdminPermissionRoute adminOnly><ProcessGuide /></AdminPermissionRoute>} />
                  <Route path="merchant-presentation" element={<AdminPermissionRoute adminOnly><ProcessPresentation audience="merchant" /></AdminPermissionRoute>} />
                  <Route path="reseller-presentation" element={<AdminPermissionRoute adminOnly><ProcessPresentation audience="reseller" /></AdminPermissionRoute>} />
                  <Route path="merchants" element={<AdminPermissionRoute permission="merchants"><Merchants /></AdminPermissionRoute>} />
                  <Route path="merchant-followups" element={<AdminPermissionRoute permission="merchants"><MerchantFollowups /></AdminPermissionRoute>} />
                  <Route path="payments" element={<AdminPermissionRoute permission="payments"><Payments /></AdminPermissionRoute>} />
                  <Route path="topups" element={<AdminPermissionRoute permission="topups"><TopupRequests /></AdminPermissionRoute>} />
                  <Route path="withdrawals" element={<AdminPermissionRoute permission="withdrawals"><WithdrawalRequests /></AdminPermissionRoute>} />
                  <Route path="chats" element={<AdminPermissionRoute permission="chats"><ChatHistory /></AdminPermissionRoute>} />
                  <Route path="chats/:merchantId/:resellerId" element={<AdminPermissionRoute permission="chats"><ChatHistoryDetail /></AdminPermissionRoute>} />
                  <Route path="support-chats" element={<AdminPermissionRoute permission="support"><SupportChats /></AdminPermissionRoute>} />
                  <Route path="support/:userId" element={<AdminPermissionRoute permission="support"><SupportChats /></AdminPermissionRoute>} />
                  <Route path="categories" element={<AdminPermissionRoute permission="categories"><Categories /></AdminPermissionRoute>} />
                  <Route path="subscriptions" element={<AdminPermissionRoute permission="subscriptions"><Subscriptions /></AdminPermissionRoute>} />
                  <Route path="homepage" element={<AdminPermissionRoute permission="homepage"><HomepageEditor /></AdminPermissionRoute>} />
                  <Route path="wallet" element={<AdminPermissionRoute permission="wallet"><AdminWallet /></AdminPermissionRoute>} />
                  <Route path="sales" element={<AdminPermissionRoute permission="sales"><Sales /></AdminPermissionRoute>} />
                  <Route path="reports/sales" element={<AdminPermissionRoute permission="reports"><AdminSalesReport /></AdminPermissionRoute>} />
                  <Route path="reports/campaigns" element={<AdminPermissionRoute permission="reports"><AdminCampaignPerformanceReport /></AdminPermissionRoute>} />
                  <Route path="reports/inventory" element={<AdminPermissionRoute permission="reports"><AdminInventoryReport /></AdminPermissionRoute>} />
                  <Route path="reports/topups" element={<AdminPermissionRoute permission="reports"><AdminTopupReport /></AdminPermissionRoute>} />
                  <Route path="reports/withdrawals" element={<AdminPermissionRoute permission="reports"><AdminWithdrawalReport /></AdminPermissionRoute>} />
                  <Route path="reports/ordered" element={<AdminPermissionRoute permission="reports"><AdminOrderedReport /></AdminPermissionRoute>} />
                  <Route path="login-history" element={<AdminPermissionRoute permission="login_history"><LoginHistory /></AdminPermissionRoute>} />
                  <Route path="reviews" element={<AdminPermissionRoute permission="reviews"><ReviewsManagement admin /></AdminPermissionRoute>} />
                  <Route path="campaigns" element={<AdminPermissionRoute permission="campaigns"><AdminCampaigns /></AdminPermissionRoute>} />
                  <Route path="vouchers" element={<AdminPermissionRoute permission="vouchers"><AdminVouchers /></AdminPermissionRoute>} />
                  <Route path="registrations" element={<AdminPermissionRoute permission="registrations"><AdminRegistrations /></AdminPermissionRoute>} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
