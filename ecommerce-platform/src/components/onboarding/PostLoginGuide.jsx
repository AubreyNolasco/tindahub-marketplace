import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, ClipboardCheck, Store, UserRoundCheck, Users, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getAdminHomePath } from '../../config/adminPermissions'

function guideFor(profile, role) {
  if (profile?.onboarding_completed === false) return {
    eyebrow: 'New account setup',
    title: 'Welcome to JOM HUB',
    message: 'Choose how you will use JOM HUB, then complete the required account details.',
    icon: UserRoundCheck,
    steps: ['Choose Reseller or Merchant.', 'Enter your phone number and complete address.', 'Submit the required account verification details.'],
    action: 'Choose my role',
    to: '/onboarding'
  }
  if (profile?.account_status !== 'approved' && role === 'merchant') return {
    eyebrow: 'Merchant application', title: 'Complete your Merchant activation',
    message: 'Your workspace opens after the required documents and payment are reviewed.', icon: Store,
    steps: ['Upload a readable business permit.', 'Choose a subscription and submit payment proof.', 'Wait for Admin approval.'],
    action: 'Continue Merchant setup', to: '/merchant-permit'
  }
  if (profile?.account_status !== 'approved' && role === 'reseller') return {
    eyebrow: 'Reseller application', title: 'Your application is being reviewed',
    message: 'Admin must verify your initial wallet top-up before the workspace is activated.', icon: Users,
    steps: ['Keep your payment reference and proof.', 'Wait for the Admin verification result.', 'Return here later to check your account status.'],
    action: 'View application status', to: '/pending-approval'
  }
  if (role === 'merchant') return {
    eyebrow: 'Merchant next steps', title: 'Start managing your store',
    message: 'Keep your store accurate so Resellers can confidently place orders.', icon: Store,
    steps: ['Review your business and pickup address.', 'Add your first product with stock and pricing.', 'Check Orders regularly for new requests.'],
    action: 'Open Merchant dashboard', to: '/merchant'
  }
  if (role === 'reseller') return {
    eyebrow: 'Reseller next steps', title: 'Prepare your first sale',
    message: 'Set up the customer and confirm all costs before placing an order.', icon: Users,
    steps: ['Get a Merchant product for My Product List.', 'Customize and share your customer-store link.', 'Record the committed customer before checkout.'],
    action: 'Open Reseller dashboard', to: '/reseller'
  }
  return {
    eyebrow: role === 'staff' ? 'Staff next steps' : 'Admin next steps',
    title: 'Review today’s operations',
    message: role === 'staff' ? 'Use only the modules assigned to your staff account.' : 'Start with items that require review or approval.',
    icon: ClipboardCheck,
    steps: ['Review pending notifications and approvals.', 'Check recent account and payment activity.', 'Use reports and audit records for verification.'],
    action: role === 'staff' ? 'Open my workspace' : 'Open Admin Center', to: getAdminHomePath(profile)
  }
}

export default function PostLoginGuide() {
  const { session, user, profile, role, loading, deviceAccessStatus } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const guide = useMemo(() => guideFor(profile, role), [profile, role])
  const storageKey = user ? `rmhub_login_guide_seen_${user.id}_${user.last_sign_in_at || session?.expires_at || 'session'}` : ''

  useEffect(() => {
    if (deviceAccessStatus !== 'active') {
      setOpen(false)
      return
    }
    if (loading || !user || !profile || !storageKey || ['/auth/callback', '/device-access'].includes(location.pathname)) return
    try { setOpen(!sessionStorage.getItem(storageKey)) } catch { setOpen(true) }
  }, [deviceAccessStatus, loading, user, profile, storageKey, location.pathname])

  if (!open || !user || !profile || deviceAccessStatus !== 'active') return null
  const Icon = guide.icon
  const close = () => {
    try { sessionStorage.setItem(storageKey, 'true') } catch { /* restricted storage */ }
    setOpen(false)
  }
  const continueToNextStep = () => { close(); navigate(guide.to) }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/65 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="post-login-guide-title"><div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="bg-gradient-to-br from-teal-950 to-teal-700 p-6 text-white sm:p-8"><div className="flex items-start justify-between gap-4"><span className="grid h-13 w-13 place-items-center rounded-2xl bg-white/10 p-3 text-mango-300"><Icon size={26} /></span><button type="button" onClick={close} className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20" aria-label="Close next-step guide"><X size={20} /></button></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-mango-300">{guide.eyebrow}</p><h2 id="post-login-guide-title" className="mt-2 font-display text-2xl font-bold sm:text-3xl">{guide.title}</h2><p className="mt-2 text-sm leading-6 text-white/65">{guide.message}</p></header><div className="p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">What to do next</p><ol className="mt-4 space-y-3">{guide.steps.map((step, index) => <li key={step} className="flex items-start gap-3 rounded-xl bg-cream p-3 text-sm leading-6 text-ink/65"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">{index + 1}</span><span>{step}</span></li>)}</ol><div className="mt-5 flex items-start gap-2 rounded-xl border border-mango-300 bg-mango-100/50 p-3 text-xs leading-5 text-ink/60"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-mango-700" />You can close this guide and continue later. Your account status and saved information will remain available.</div><button type="button" onClick={continueToNextStep} className="btn-primary mt-5 flex w-full items-center justify-center gap-2">{guide.action}<ArrowRight size={17} /></button><button type="button" onClick={close} className="mt-2 w-full py-2 text-xs font-bold text-ink/45 hover:text-teal-700">Close for now</button></div></div></div>
}
