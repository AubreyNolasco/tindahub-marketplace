import { Link } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, BadgeCheck, Banknote, Building2, CheckCircle2, CircleDollarSign,
  Clock3, CreditCard, ExternalLink, IdCard, Lock, PackageCheck, Printer, ShieldAlert,
  ShieldCheck, ShoppingBag, Store, Truck, Undo2, UserRound, Users, Wallet, WalletCards, Zap
} from 'lucide-react'

const lanes = [
  {
    title: '0. Getting In — Two Separate Approval Gates',
    subtitle: 'Merchant and Reseller each clear a different pair of requirements before the account unlocks',
    tone: 'teal',
    steps: [
      { icon: UserRound, role: 'User', title: 'Sign up & pick a role', text: 'Verify Gmail with a 6-digit OTP, choose Merchant or Reseller. The dashboard opens immediately — browsing isn’t blocked while waiting.' },
      { icon: CreditCard, role: 'Merchant', title: 'Permit + subscription', text: 'Upload a business permit and submit a subscription request (a free 6-month plan is auto-granted at signup so listing isn’t blocked while waiting).' },
      { icon: IdCard, role: 'Reseller', title: 'ID + initial top-up', text: 'Submit a selfie + government ID for verification, and an initial wallet top-up request.' },
      { icon: ShieldCheck, role: 'Admin', title: 'Approve both conditions', text: 'Merchant needs permit approved AND an active subscription; Reseller needs ID approved AND a completed top-up. Only then does the account flip to approved.' }
    ]
  },
  {
    title: '1. Product Supply',
    subtitle: 'Merchant creates the available inventory',
    tone: 'mango',
    steps: [
      { icon: Building2, role: 'Merchant', title: 'Add a product', text: 'Set details, photos, stock, wholesale price, retail price, and optional quantity discount tiers.' },
      { icon: ShieldCheck, role: 'Admin', title: 'Monitor listings', text: 'Review products and prohibited content when intervention is needed.' },
      { icon: PackageCheck, role: 'System', title: 'Publish to catalog', text: 'Eligible products become available to every approved Reseller.' }
    ]
  },
  {
    title: '2a. Order Starts — Reseller Buys Wholesale',
    subtitle: 'The Reseller stocks up directly from the Merchant catalog',
    tone: 'coral',
    steps: [
      { icon: ShoppingBag, role: 'Reseller', title: 'Browse the catalog', text: 'Compare wholesale price, stock, and quantity discount tiers across Merchants.' },
      { icon: Wallet, role: 'Reseller', title: 'Add to cart', text: 'Set quantity, and optionally a customer selling price if this stock is earmarked for a specific saved customer.' }
    ]
  },
  {
    title: '2b. Order Starts — Customer Orders From a Storefront',
    subtitle: 'Both paths land in the exact same cart below',
    tone: 'violet',
    steps: [
      { icon: Store, role: 'Customer', title: 'Open the storefront', text: 'A public link the Reseller shares — only that Reseller’s selected products appear, no account needed.' },
      { icon: ExternalLink, role: 'Customer', title: 'Order, or contact directly', text: 'Submit an order request (qty, name, phone, address) straight from the product popup, or fall back to Facebook / phone / Viber / WhatsApp.' },
      { icon: Users, role: 'Reseller', title: 'Accept in Customer Orders', text: 'Reviews the request in their own inbox; Accept or Decline.' },
      { icon: BadgeCheck, role: 'Reseller', title: 'Convert to cart', text: 'Finds or creates the customer record, then adds the product to the same cart the wholesale path uses.' }
    ]
  },
  {
    title: '3. Checkout & Escrow',
    subtitle: 'Every order — wholesale or customer-converted — settles through this one shared step',
    tone: 'blue',
    steps: [
      { icon: CircleDollarSign, role: 'System', title: 'Quote the price', text: 'Server-computed subtotal, a ~1% Reseller service fee (capped ₱3–₱50), and the Merchant’s success fee shown for reference.' },
      { icon: WalletCards, role: 'Reseller', title: 'Pay & place order', text: 'Server re-checks stock and price before committing — the price shown is never trusted from the browser.' },
      { icon: Lock, role: 'System', title: 'Wallet debited immediately', text: 'Funds leave the Reseller’s wallet right away and are held as escrow — the Merchant is not paid yet.' }
    ]
  },
  {
    title: '4. Delivery',
    subtitle: 'Two ways to ship, one way to auto-close',
    tone: 'mango',
    steps: [
      { icon: Truck, role: 'Merchant', title: 'Ship manually…', text: 'Marks the order shipped with a tracking number, provider, and estimated delivery date.' },
      { icon: Zap, role: 'System', title: '…or book via Lalamove', text: 'Reseller accepts a quote (tried in order: Merchant’s connected account → Reseller’s → Platform’s); booking fires automatically once accepted.' },
      { icon: Clock3, role: 'System', title: 'Auto-complete after 7 days', text: 'If nobody opens a dispute (an Order Case) in that window, the order is marked completed automatically.' }
    ]
  },
  {
    title: '5. Settlement',
    subtitle: 'This is when money actually reaches the Merchant',
    tone: 'teal',
    steps: [
      { icon: CheckCircle2, role: 'System', title: 'Merchant gets paid', text: 'On completion, the Merchant’s wallet is credited the product subtotal minus the Merchant success fee.' },
      { icon: Undo2, role: 'System', title: 'Or refunded on cancel', text: 'If the order is cancelled instead, the full escrowed amount returns to the Reseller’s wallet.' }
    ]
  }
]

const tones = {
  teal: 'border-teal-200 bg-teal-50 text-teal-800',
  mango: 'border-mango-200 bg-mango-100 text-mango-700',
  coral: 'border-coral-200 bg-coral-100 text-coral-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-800',
  blue: 'border-sky-200 bg-sky-50 text-sky-800'
}

const roleTones = {
  Admin: 'bg-slate-800 text-white',
  Merchant: 'bg-mango-100 text-mango-700',
  Reseller: 'bg-coral-100 text-coral-700',
  Customer: 'bg-violet-100 text-violet-800',
  System: 'bg-teal-100 text-teal-800',
  User: 'bg-sky-100 text-sky-800'
}

function StepCard({ step, number }) {
  const Icon = step.icon
  return (
    <article className="relative min-w-0 flex-1 rounded-2xl border border-black/[0.07] bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-950 text-white">
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-ink/35">Step {number}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${roleTones[step.role]}`}>{step.role}</span>
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-ink">{step.title}</h3>
          <p className="mt-1.5 text-xs leading-5 text-ink/60 sm:text-sm sm:leading-6">{step.text}</p>
        </div>
      </div>
    </article>
  )
}

const walletLoop = [
  {
    title: 'Top-up (money in)',
    tone: 'teal',
    steps: [
      'Reseller/Merchant submits a top-up request — either manual (screenshot + reference) or automatic online payment.',
      'Manual requests wait for Admin approval. Online payments (PayMongo checkout) are approved automatically by the payment webhook.',
      'Either way, the same trigger credits the wallet the moment status flips to approved.'
    ]
  },
  {
    title: 'Withdrawal (money out)',
    tone: 'coral',
    steps: [
      'Reseller/Merchant requests a withdrawal — the wallet is debited immediately (funds held), min ₱500, capped ₱100,000/day.',
      'Admin approves or rejects the request.',
      'Once approved, Admin uploads proof of the actual bank transfer to close it out.'
    ]
  }
]

const adminGroups = [
  { title: 'Approvals & Trust', items: ['Approval Center (Merchant permit + subscription)', 'Reseller ID Verification', 'Order Cases (disputes, cancellations, refunds)', 'Products (listing moderation)', 'Merchants (business profiles, permit review)'] },
  { title: 'Money', items: ['Payments', 'Top-Up Requests', 'Withdrawal Requests', 'Platform Wallet', 'Sales', 'Subscriptions'] },
  { title: 'Platform Config', items: ['Delivery Providers (platform Lalamove fallback)', 'Integrations (PayMongo, SMS, Vision, etc.)', 'Legal Settings', 'Categories', 'Homepage Editor'] },
  { title: 'People & Support', items: ['Staff Access', 'Full Access', 'Chat History / Support Chats', 'Login History', 'Activity Audit'] },
  { title: 'Reports', items: ['Sales', 'Inventory', 'Top-Up', 'Withdrawal', 'Ordered'] }
]

export default function FullSystemFlowchart() {
  let stepNumber = 0
  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link to="/admin/system-flowchart" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline print:hidden">
        <ArrowLeft size={15} /> Back to the short version
      </Link>
      <header className="rounded-3xl bg-gradient-to-br from-teal-950 via-teal-800 to-teal-600 p-5 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-mango-300">Admin reference — full detail</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Full System Flowchart</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70 sm:text-base">
              Every step from account approval to money settling in a Merchant's wallet — including the escrow mechanic, both delivery paths, and the wallet funding/cashout loop.
            </p>
          </div>
          <button type="button" onClick={() => window.print()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm font-bold text-teal-900 transition hover:bg-mango-100 print:hidden">
            <Printer size={17} /> Print
          </button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {Object.keys(roleTones).map((role) => <span key={role} className={`rounded-full px-3 py-1.5 text-xs font-bold ${roleTones[role]}`}>{role}</span>)}
        </div>
      </header>

      <div className="mt-6 space-y-3">
        {lanes.map((lane, laneIndex) => (
          <section key={lane.title}>
            <div className={`rounded-2xl border p-4 sm:p-5 ${tones[lane.tone]}`}>
              <h2 className="font-display text-lg font-extrabold sm:text-xl">{lane.title}</h2>
              <p className="mt-1 text-xs opacity-70 sm:text-sm">{lane.subtitle}</p>
            </div>
            <div className="relative mt-3 flex flex-col gap-2 lg:flex-row lg:items-stretch">
              {lane.steps.map((step, stepIndex) => {
                stepNumber += 1
                return (
                  <div key={step.title} className="contents">
                    <StepCard step={step} number={stepNumber} />
                    {stepIndex < lane.steps.length - 1 && (
                      <div className="grid shrink-0 place-items-center text-teal-600">
                        <ArrowDown size={20} className="lg:-rotate-90" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {laneIndex < lanes.length - 1 && (
              <div className="flex h-12 items-center justify-center text-teal-600">
                <ArrowDown size={24} />
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="mt-10">
        <div className="rounded-2xl border border-black/[0.07] bg-surface p-4 sm:p-5">
          <h2 className="font-display text-lg font-extrabold text-ink sm:text-xl">Wallet Funding &amp; Cashout Loop</h2>
          <p className="mt-1 text-xs text-ink/55 sm:text-sm">Runs independently of the order flow above — every Reseller and Merchant wallet feeds from here.</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {walletLoop.map((col) => (
            <div key={col.title} className={`rounded-2xl border p-4 sm:p-5 ${tones[col.tone]}`}>
              <div className="flex items-center gap-2">
                <Banknote size={18} />
                <h3 className="font-display text-base font-bold">{col.title}</h3>
              </div>
              <ol className="mt-3 space-y-2 text-xs leading-5 sm:text-sm sm:leading-6">
                {col.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 shrink-0 font-extrabold opacity-50">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="rounded-2xl border border-black/[0.07] bg-surface p-4 sm:p-5">
          <h2 className="font-display text-lg font-extrabold text-ink sm:text-xl">Admin Oversight</h2>
          <p className="mt-1 text-xs text-ink/55 sm:text-sm">Not a flow — this is what Admin is watching day to day while the above runs.</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminGroups.map((group) => (
            <div key={group.title} className="rounded-2xl border border-black/[0.07] bg-surface p-4">
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldAlert size={16} />
                <h3 className="font-display text-sm font-extrabold">{group.title}</h3>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-5 text-ink/65">
                {group.items.map((item) => <li key={item}>· {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
