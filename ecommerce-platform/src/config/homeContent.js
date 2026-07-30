import {
  BadgeCheck, BarChart3, Building2, FileImage, Handshake, LockKeyhole,
  MessageCircle, PackageCheck, ShieldCheck, ShoppingBag, Smartphone,
  Sparkles, Stethoscope, Store, TrendingUp, Truck, UsersRound, Wallet
} from 'lucide-react'

export const fallback = {
  eyebrow: 'Built for growing Filipino businesses 🇵🇭',
  title: 'Grow your business on a marketplace you can trust.',
  description: 'JOM HUB connects Merchants and Resellers with product sourcing, secure wallet payments, order tracking, business reports, and direct communication — all in one workspace.',
  hero_image: '/hero/filipino-market-vendors.jpg',
  hero_image_mobile: '/hero/filipino-market-vendors.jpg',
  hero_button: 'Start your business', hero_border: 'rounded', hero_accent: '#16794B',
  announcement: { enabled: true, text: 'Welcome to JOM HUB — built for growing Filipino businesses', link_text: 'Join now', link_url: '/signup', background: '#0B4D30', color: '#FFFFFF' },
  banners: [],
  sections: { benefits: true, process: true, subscription: true, topup: true, final_cta: true }
}

export const transactionSteps = [
  { icon: ShoppingBag, title: 'Discover', text: 'Browse products from approved Merchants. Compare price, stock, and minimum order quantities.' },
  { icon: Wallet, title: 'Pay securely', text: 'Load your wallet, review the total, and submit payment through a clear, guided process.' },
  { icon: PackageCheck, title: 'Track your order', text: 'Follow every order from confirmation through processing, shipping, and completion.' },
  { icon: ShieldCheck, title: 'Complete with confidence', text: 'Merchant payout is released through a controlled marketplace process once the order is complete.' }
]

export const benefits = [
  { icon: Store, title: 'Digital storefront', text: 'Showcase your products, pricing, and business details in a professional online store.' },
  { icon: TrendingUp, title: 'More income', text: 'Connect directly with Resellers looking for reliable products and long-term suppliers.' },
  { icon: BarChart3, title: 'Business reports', text: 'Download sales, inventory, orders, top-ups, and withdrawals as Excel-ready reports.' },
  { icon: MessageCircle, title: 'Fast coordination', text: 'Keep Merchant and Reseller conversations connected to their marketplace activity.' },
  { icon: Wallet, title: 'Organized cash flow', text: 'Track wallet balance, top-ups, withdrawals, fees, payments, and payouts in one place.' },
  { icon: BadgeCheck, title: 'Admin-reviewed access', text: 'Payment proofs and account applications are reviewed for a safer community.' },
  { icon: Sparkles, title: 'Guided setup', text: 'Progress checklists and recommended next actions guide you through every step.' },
  { icon: FileImage, title: 'Printable records', text: 'Keep system-generated receipts for marketplace orders, top-ups, and withdrawals.' },
  { icon: LockKeyhole, title: 'Secure activity history', text: 'Sensitive changes are recorded and available for Admin review.' },
  { icon: Smartphone, title: 'Mobile-friendly workspace', text: 'Resellers and Merchants can move seamlessly between Home, Products, Orders, Wallet, and Account.' },
  { icon: Handshake, title: 'Clinic & real estate referrals', text: 'Refer your customers to partner clinics or real estate agents and earn a referral fee — no upfront cost.' },
  { icon: Truck, title: 'Lalamove integration', text: 'Connect to Lalamove for real-time delivery quotes and faster shipping.' }
]

export const featuredHighlights = [
  { title: 'Merchant storefronts', description: 'Launch polished digital stores with pricing, inventory, and secure order handling.', icon: Store },
  { title: 'Reseller growth', description: 'Discover trusted products, manage your cart, and scale with wallet-backed payments.', icon: UsersRound },
  { title: 'Referral income', description: 'Turn partner clinics, real estate agents, and delivery tools into recurring revenue.', icon: Handshake }
]

export const categoryCards = [
  { title: 'Merchants', description: 'Open a professional storefront and manage orders with confidence.', icon: Store, href: '/signup' },
  { title: 'Resellers', description: 'Browse, compare, and place orders with transparent pricing.', icon: ShoppingBag, href: '/signup' },
  { title: 'Clinics', description: 'Refer customers and earn commission after confirmed appointments.', icon: Stethoscope, href: '/clinics' },
  { title: 'Real estate', description: 'Connect to property referrals and grow your network.', icon: Building2, href: '/clinics' }
]

export const plans = [
  { duration: 'Starter · 6 Months', price: '₱1,599', note: '₱267/month for a new store' },
  { duration: 'Growth · 1 Year', price: '₱2,799', note: '₱233/month — best value', featured: true },
  { duration: 'Pro · 2 Years', price: '₱4,999', note: '₱208/month for the long term' }
]

export const faqs = [
  {
    q: 'How do I get started as a Merchant?',
    a: 'Sign up with your Gmail, enter the 6-digit OTP, and choose the "Merchant" role. Complete your business details and you\'ll land in your dashboard right away with a free 6-month subscription, no payment needed to start. Upload a valid business permit — posting products stays locked until Admin approves it, or grants you temporary access on request while it\'s under review. Renew anytime from your dashboard before your free 6 months ends to keep it active.'
  },
  {
    q: 'How do I get started as a Reseller?',
    a: 'Sign up with your Gmail, enter the 6-digit OTP, and choose the "Reseller" role. Complete your contact and delivery address and you\'ll land in your dashboard right away — no wallet top-up required to finish signing up. Verify your identity and top up your wallet whenever you\'re ready; placing orders unlocks once Admin approves both.'
  },
  {
    q: 'How does the Clinic Referral System work?',
    a: 'Go to the clinics page, choose a partner dental or optical clinic and their service, then refer your customer by entering their details. Once the appointment is confirmed by the clinic, the referral fee is automatically transferred to your wallet.'
  },
  {
    q: 'How does Real Estate Referral work?',
    a: 'Browse partner real estate agents and properties on the services page, then refer your customer to the agent. Once a property viewing is scheduled and the transaction is completed, you receive a referral fee — at no upfront cost to you.'
  },
  {
    q: 'What are the payment options?',
    a: 'Use JOM HUB InstaPay QR to top up your wallet. Scan the QR, enter the amount, and upload your payment screenshot along with the one-use reference number. Admin reviews the payment before your wallet is credited.'
  },
  {
    q: 'How does Lalamove delivery work?',
    a: 'Merchants connect their Lalamove account in settings. When a Reseller places an order, they get a real-time delivery quote. Metro Manila and Cebu areas are supported.'
  }
]

export const testimonials = [
  { text: 'Finding a reliable supplier used to be so hard. With JOM HUB, it only takes one click — my order gets placed and delivered right away. It saved me so much time and hassle.', name: 'Maria Santos', role: 'Reseller — Bulacan', avatar: 'MS' },
  { text: 'I never expected having a digital storefront to make this much of a difference. My sales grew 40% in the first three months. JOM HUB is easy to use and genuinely professional.', name: 'Juan dela Cruz', role: 'Merchant — Manila', avatar: 'JC' },
  { text: 'I no longer have to collect cash or keep manual records. Orders, payments, reports — everything is automated now. It has been a huge help for my small business.', name: 'Ana Gonzales', role: 'Merchant — Cebu', avatar: 'AG' },
  { text: 'As a reseller, inventory and pricing transparency matter a lot to me. JOM HUB gives me real-time updates from my suppliers. It has been a game changer.', name: 'Carlos Reyes', role: 'Reseller — Laguna', avatar: 'CR' },
  { text: 'The clinic referral system is fantastic. I referred just two customers and received the referral fee straight to my wallet right away — no hassle, no paperwork.', name: 'Diana Lopez', role: 'Reseller — Quezon City', avatar: 'DL' },
  { text: 'I was hesitant at first because I am not very tech-savvy, but the interface is so intuitive that I picked it up right away. Now I use JOM HUB every day for my store.', name: 'Elena Martinez', role: 'Merchant — Davao', avatar: 'EM' }
]
