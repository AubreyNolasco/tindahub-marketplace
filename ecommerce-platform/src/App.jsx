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

import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Catalog from './pages/Catalog'
import ProductDetail from './pages/ProductDetail'
import MerchantStore from './pages/MerchantStore'
import Policy from './pages/Policy'
import Login from './pages/Auth/Login'
import PendingApproval from './pages/Auth/PendingApproval'
import ChooseSubscription from './pages/Auth/ChooseSubscription'
import AuthCallback from './pages/Auth/AuthCallback'
import AuthContinue from './pages/Auth/AuthContinue'
import Onboarding from './pages/Auth/Onboarding'
import DeviceAccessAction from './pages/Auth/DeviceAccessAction'

import ResellerLayout from './pages/Reseller/ResellerLayout'
import ResellerDashboard from './pages/Reseller/ResellerDashboard'
import Cart from './pages/Reseller/Cart'
import Checkout from './pages/Reseller/Checkout'
import OrderHistory from './pages/Reseller/OrderHistory'
import Customers from './pages/Reseller/Customers'
import ResellerWallet from './pages/Reseller/WalletPage'
import ResellerChats from './pages/Reseller/Chats'
import ResellerChatDetail from './pages/Reseller/ChatDetail'
import ResellerSalesReport from './pages/Reseller/Reports/SalesReport'
import ResellerInventoryReport from './pages/Reseller/Reports/InventoryReport'
import ResellerTopupReport from './pages/Reseller/Reports/TopupReport'
import ResellerWithdrawalReport from './pages/Reseller/Reports/WithdrawalReport'
import ResellerOrderedReport from './pages/Reseller/Reports/OrderedReport'
import StorefrontProducts from './pages/Reseller/StorefrontProducts'
import ResellerStorefront from './pages/ResellerStorefront'
import ClinicDiscovery from './pages/Reseller/ClinicDiscovery'
import MyReferrals from './pages/Reseller/MyReferrals'
import DeliverySettings from './pages/Reseller/DeliverySettings'
import IdVerification from './pages/Reseller/IdVerification'

import MerchantLayout from './pages/Merchant/MerchantLayout'
import ServiceSettings from './pages/Merchant/ServiceSettings'
import ClinicServices from './pages/Merchant/ClinicServices'
import ReferralRequests from './pages/Merchant/ReferralRequests'
import MerchantDashboard from './pages/Merchant/MerchantDashboard'
import Products from './pages/Merchant/Products'
import ProductForm from './pages/Merchant/ProductForm'
import Orders from './pages/Merchant/Orders'
import WalletPage from './pages/Merchant/WalletPage'
import Purchases from './pages/Merchant/Purchases'
import MerchantChats from './pages/Merchant/Chats'
import MerchantChatDetail from './pages/Merchant/ChatDetail'
import MerchantSalesReport from './pages/Merchant/Reports/SalesReport'
import MerchantInventoryReport from './pages/Merchant/Reports/InventoryReport'
import MerchantTopupReport from './pages/Merchant/Reports/TopupReport'
import MerchantWithdrawalReport from './pages/Merchant/Reports/WithdrawalReport'
import MerchantOrderedReport from './pages/Merchant/Reports/OrderedReport'

import AdminLayout from './pages/Admin/AdminLayout'
import AdminDashboard from './pages/Admin/AdminDashboard'
import Merchants from './pages/Admin/Merchants'
import Payments from './pages/Admin/Payments'
import TopupRequests from './pages/Admin/TopupRequests'
import WithdrawalRequests from './pages/Admin/WithdrawalRequests'
import ChatHistory from './pages/Admin/ChatHistory'
import ChatHistoryDetail from './pages/Admin/ChatHistoryDetail'
import Categories from './pages/Admin/Categories'
import Subscriptions from './pages/Admin/Subscriptions'
import HomepageEditor from './pages/Admin/HomepageEditor'
import ProcessPresentation from './pages/Admin/ProcessPresentation'
import AdminWallet from './pages/Admin/Wallet'
import Sales from './pages/Admin/Sales'
import AdminSalesReport from './pages/Admin/Reports/SalesReport'
import AdminInventoryReport from './pages/Admin/Reports/InventoryReport'
import AdminTopupReport from './pages/Admin/Reports/TopupReport'
import AdminWithdrawalReport from './pages/Admin/Reports/WithdrawalReport'
import AdminOrderedReport from './pages/Admin/Reports/OrderedReport'
import LoginHistory from './pages/Admin/LoginHistory'
import ReviewsManagement from './pages/ReviewsManagement'
import AdminCampaigns from './pages/Admin/Campaigns'
import MerchantCampaigns from './pages/Merchant/Campaigns'
import ProfileAddress from './pages/ProfileAddress'
import AccountSettings from './pages/AccountSettings'
import AdminRegistrations from './pages/Admin/Registrations'
import BusinessPermit from './pages/Merchant/BusinessPermit'
import StaffManagement from './pages/Admin/StaffManagement'
import LegalSettings from './pages/Admin/LegalSettings'
import ProcessGuide from './pages/Admin/ProcessGuide'
import SystemFlowchart from './pages/Admin/SystemFlowchart'
import AdminPermissionRoute from './components/auth/AdminPermissionRoute'
import AdminFullAccess from './pages/Admin/FullAccess'
import ApprovalCenter from './pages/Admin/ApprovalCenter'
import OrderCases from './pages/Admin/OrderCases'
import ActivityLog from './pages/Admin/ActivityLog'
import TestAccounts from './pages/Admin/TestAccounts'
import ResellerVerifications from './pages/Admin/ResellerVerifications'

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
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/catalog" element={<ProtectedRoute allowedRoles={['reseller','merchant','admin','staff']}><Catalog /></ProtectedRoute>} />
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
                <Route path="/choose-subscription" element={<ChooseSubscription />} />
                <Route path="/merchant-permit" element={<ProtectedRoute allowedRoles={['merchant']} allowUnverifiedMerchant><BusinessPermit /></ProtectedRoute>} />
                <Route path="/verify-id" element={<IdVerification />} />
                <Route path="/clinics" element={<ProtectedRoute allowedRoles={['reseller','merchant','admin']}><ClinicDiscovery /></ProtectedRoute>} />

                {/* Reseller */}
                <Route path="/cart" element={<ProtectedRoute allowedRoles={['reseller', 'merchant']}><Cart /></ProtectedRoute>} />
                <Route path="/checkout/:merchantId" element={<ProtectedRoute allowedRoles={['reseller', 'merchant']}><Checkout /></ProtectedRoute>} />
                <Route path="/reseller" element={<ProtectedRoute allowedRoles={['reseller']}><ResellerLayout /></ProtectedRoute>}>
                  <Route index element={<ResellerDashboard />} />
                  <Route path="orders" element={<OrderHistory />} />
                  <Route path="products" element={<StorefrontProducts />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="chats" element={<ResellerChats />} />
                  <Route path="chats/:merchantId" element={<ResellerChatDetail />} />
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
                  <Route path="orders" element={<Orders />} />
                  <Route path="purchases" element={<Purchases />} />
                  <Route path="chats" element={<MerchantChats />} />
                  <Route path="chats/:resellerId" element={<MerchantChatDetail />} />
                  <Route path="wallet" element={<WalletPage />} />
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
                  <Route path="system-flowchart" element={<AdminPermissionRoute adminOnly><SystemFlowchart /></AdminPermissionRoute>} />
                  <Route path="process-guide" element={<AdminPermissionRoute adminOnly><ProcessGuide /></AdminPermissionRoute>} />
                  <Route path="merchant-presentation" element={<AdminPermissionRoute adminOnly><ProcessPresentation audience="merchant" /></AdminPermissionRoute>} />
                  <Route path="reseller-presentation" element={<AdminPermissionRoute adminOnly><ProcessPresentation audience="reseller" /></AdminPermissionRoute>} />
                  <Route path="merchants" element={<AdminPermissionRoute permission="merchants"><Merchants /></AdminPermissionRoute>} />
                  <Route path="payments" element={<AdminPermissionRoute permission="payments"><Payments /></AdminPermissionRoute>} />
                  <Route path="topups" element={<AdminPermissionRoute permission="topups"><TopupRequests /></AdminPermissionRoute>} />
                  <Route path="withdrawals" element={<AdminPermissionRoute permission="withdrawals"><WithdrawalRequests /></AdminPermissionRoute>} />
                  <Route path="chats" element={<AdminPermissionRoute permission="chats"><ChatHistory /></AdminPermissionRoute>} />
                  <Route path="chats/:merchantId/:resellerId" element={<AdminPermissionRoute permission="chats"><ChatHistoryDetail /></AdminPermissionRoute>} />
                  <Route path="categories" element={<AdminPermissionRoute permission="categories"><Categories /></AdminPermissionRoute>} />
                  <Route path="subscriptions" element={<AdminPermissionRoute permission="subscriptions"><Subscriptions /></AdminPermissionRoute>} />
                  <Route path="homepage" element={<AdminPermissionRoute permission="homepage"><HomepageEditor /></AdminPermissionRoute>} />
                  <Route path="wallet" element={<AdminPermissionRoute permission="wallet"><AdminWallet /></AdminPermissionRoute>} />
                  <Route path="sales" element={<AdminPermissionRoute permission="sales"><Sales /></AdminPermissionRoute>} />
                  <Route path="reports/sales" element={<AdminPermissionRoute permission="reports"><AdminSalesReport /></AdminPermissionRoute>} />
                  <Route path="reports/inventory" element={<AdminPermissionRoute permission="reports"><AdminInventoryReport /></AdminPermissionRoute>} />
                  <Route path="reports/topups" element={<AdminPermissionRoute permission="reports"><AdminTopupReport /></AdminPermissionRoute>} />
                  <Route path="reports/withdrawals" element={<AdminPermissionRoute permission="reports"><AdminWithdrawalReport /></AdminPermissionRoute>} />
                  <Route path="reports/ordered" element={<AdminPermissionRoute permission="reports"><AdminOrderedReport /></AdminPermissionRoute>} />
                  <Route path="login-history" element={<AdminPermissionRoute permission="login_history"><LoginHistory /></AdminPermissionRoute>} />
                  <Route path="reviews" element={<AdminPermissionRoute permission="reviews"><ReviewsManagement admin /></AdminPermissionRoute>} />
                  <Route path="campaigns" element={<AdminPermissionRoute permission="campaigns"><AdminCampaigns /></AdminPermissionRoute>} />
                  <Route path="registrations" element={<AdminPermissionRoute permission="registrations"><AdminRegistrations /></AdminPermissionRoute>} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
