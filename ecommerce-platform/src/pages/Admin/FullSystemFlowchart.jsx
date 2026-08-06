import { Link } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, ArrowRight, BadgeCheck, Banknote, Building2, CheckCircle2, CircleDollarSign,
  Clock3, CreditCard, ExternalLink, GitBranch, IdCard, Lock, PackageCheck, Printer, ShieldAlert,
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
  teal: 'border-teal-500/25 bg-teal-500/10 text-teal-800 dark:text-teal-200',
  mango: 'border-mango-500/25 bg-mango-500/10 text-mango-800 dark:text-mango-200',
  coral: 'border-coral-500/25 bg-coral-500/10 text-coral-800 dark:text-coral-200',
  violet: 'border-violet-500/25 bg-violet-500/10 text-violet-800 dark:text-violet-200',
  blue: 'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200'
}

const roleTones = {
  Admin: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900',
  Merchant: 'bg-mango-500/15 text-mango-700 dark:text-mango-300',
  Reseller: 'bg-coral-500/15 text-coral-700 dark:text-coral-300',
  Customer: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  System: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  User: 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
}

// ---------------------------------------------------------------------
// The process, as a single ordered timeline — every device gets the
// same reliable, no-horizontal-scroll rendering (a wide SVG diagram
// reads fine on a monitor but is unusable on a phone). "split" stages
// render as a responsive card grid so branch/merge points still read
// as real branch/merge points, just without needing 2D diagram routing.
// ---------------------------------------------------------------------
const flowStages = [
  { type: 'split', label: 'Two separate approval gates', options: [
    { role: 'Merchant', title: 'Permit + subscription approved' },
    { role: 'Reseller', title: 'ID + wallet top-up approved' }
  ] },
  { type: 'step', role: 'Merchant', title: 'Add product to catalog', note: 'Feeds every order below — nothing downstream can start without this.' },
  { type: 'split', label: 'An order starts one of two ways', options: [
    { tag: '2a', role: 'Reseller', title: 'Browse catalog & add to cart', note: 'Wholesale purchase' },
    { tag: '2b', role: 'Customer', title: 'Orders from the storefront', note: 'Reseller accepts, then converts it to cart' }
  ] },
  { type: 'step', role: 'System', title: 'Cart', note: 'Both paths land here — from this point on, there’s only one flow.' },
  { type: 'step', role: 'System', title: 'Checkout', note: 'Quote, then pay — price and stock are re-verified on the server, never trusted from the browser.' },
  { type: 'step', role: 'System', title: 'Wallet debited immediately', note: 'Held as escrow — the Merchant is not paid yet.', accent: true },
  { type: 'split', label: 'Delivery — two ways to ship', options: [
    { role: 'Merchant', title: 'Ship manually', note: 'Tracking number + estimated delivery date' },
    { role: 'System', title: 'Book via Lalamove', note: 'Automatic, once the quote is accepted' }
  ] },
  { type: 'step', role: 'System', title: 'Auto-complete after 7 days', note: 'Unless an Order Case dispute is opened in that window.' },
  { type: 'split', label: 'Settlement', options: [
    { role: 'System', title: 'Merchant paid', note: 'Subtotal minus the Merchant success fee', accent: true },
    { role: 'System', title: 'Reseller refunded', note: 'If cancelled instead — this skips delivery entirely', accent: true, dashed: true }
  ] }
]

function MiniCard({ tag, role, title, note, accent, dashed, compact }) {
  return (
    <div className={`card relative p-4 transition-transform hover:-translate-y-0.5 ${compact ? '' : 'sm:p-5'} ${accent ? 'border-teal-500/40 bg-teal-500/[0.06]' : ''} ${dashed ? 'border-dashed' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {tag && <span className="rounded-md bg-ink/10 px-1.5 py-0.5 text-[10px] font-extrabold text-ink/50">{tag}</span>}
        {role && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${roleTones[role]}`}>{role}</span>}
        {accent && <span className="ml-auto text-teal-600 dark:text-teal-300"><Banknote size={14} /></span>}
      </div>
      <h3 className="mt-2 font-display text-sm font-bold leading-snug text-fg sm:text-base">{title}</h3>
      {note && <p className="mt-1 text-xs leading-5 text-fg-muted sm:text-sm">{note}</p>}
    </div>
  )
}

function TimelineRail({ isLast, accent }) {
  return (
    <div className="flex w-9 shrink-0 flex-col items-center">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${accent ? 'border-teal-500 bg-teal-500/15' : 'border-line bg-surface'}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${accent ? 'bg-teal-500' : 'bg-fg-muted'}`} />
      </span>
      {!isLast && <span className={`mt-1 w-px flex-1 ${accent ? 'bg-teal-500/40' : 'bg-line'}`} />}
    </div>
  )
}

function ProcessTimeline() {
  return (
    <figure>
      <div>
        {flowStages.map((stage, i) => {
          const isLast = i === flowStages.length - 1
          return (
            <div key={i} className="flex gap-3 sm:gap-4">
              <TimelineRail isLast={isLast} accent={stage.accent || stage.options?.some((o) => o.accent)} />
              <div className={`min-w-0 flex-1 ${isLast ? 'pb-1' : 'pb-6 sm:pb-8'}`}>
                {stage.type === 'step' ? (
                  <MiniCard role={stage.role} title={stage.title} note={stage.note} accent={stage.accent} />
                ) : (
                  <>
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-fg-muted">
                      <GitBranch size={13} /> {stage.label}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {stage.options.map((opt) => <MiniCard key={opt.title} {...opt} compact />)}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <figcaption className="mt-1 flex items-start gap-2 text-xs leading-5 text-fg-muted sm:text-sm">
        <Banknote size={14} className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-300" />
        The teal-marked steps are the money path: it leaves the Reseller's wallet at Checkout and only reaches the Merchant at Settlement — cancelling anywhere before then sends it back to the Reseller instead, without waiting for delivery.
      </figcaption>
    </figure>
  )
}

function StepCard({ step, number }) {
  const Icon = step.icon
  return (
    <article className="card relative min-w-0 flex-1 p-4 transition-transform hover:-translate-y-0.5 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-950 text-white">
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-fg-muted">Step {number}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${roleTones[step.role]}`}>{step.role}</span>
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-fg">{step.title}</h3>
          <p className="mt-1.5 text-xs leading-5 text-fg-muted sm:text-sm sm:leading-6">{step.text}</p>
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

function SectionHeading({ title, subtitle, tone }) {
  return (
    <div className={`card p-4 sm:p-5 ${tone ? tones[tone] : ''}`}>
      <h2 className="font-display text-lg font-extrabold sm:text-xl">{title}</h2>
      {subtitle && <p className="mt-1 text-xs opacity-80 sm:text-sm">{subtitle}</p>}
    </div>
  )
}

export default function FullSystemFlowchart() {
  let stepNumber = 0
  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link to="/admin/system-flowchart" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 transition hover:gap-2.5 hover:text-teal-600 dark:text-teal-300 print:hidden">
        <ArrowLeft size={15} /> Back to the short version
      </Link>

      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-950 via-teal-800 to-teal-600 p-5 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-mango-300">Admin reference — full detail</p>
            <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-4xl">Full System Flowchart</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70 sm:text-base">
              Every step from account approval to money settling in a Merchant's wallet — including the escrow mechanic, both delivery paths, and the wallet funding/cashout loop.
            </p>
          </div>
          <button type="button" onClick={() => window.print()} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-teal-900 shadow-sm transition hover:bg-mango-100 print:hidden">
            <Printer size={17} /> Print
          </button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {Object.keys(roleTones).map((role) => <span key={role} className={`rounded-full px-3 py-1.5 text-xs font-bold ${roleTones[role]}`}>{role}</span>)}
        </div>
      </header>

      <section className="mt-8">
        <SectionHeading title="The Process, Start to Finish" subtitle="Real direction, top to bottom — every split shown as an actual branch, every merge as the line continuing below it." />
        <div className="card mt-3 p-4 sm:p-6">
          <ProcessTimeline />
        </div>
      </section>

      <div className="mt-10 space-y-8">
        {lanes.map((lane) => (
          <section key={lane.title}>
            <SectionHeading title={lane.title} subtitle={lane.subtitle} tone={lane.tone} />
            <div className="relative mt-3 flex flex-col gap-2 lg:flex-row lg:items-stretch">
              {lane.steps.map((step, stepIndex) => {
                stepNumber += 1
                return (
                  <div key={step.title} className="contents">
                    <StepCard step={step} number={stepNumber} />
                    {stepIndex < lane.steps.length - 1 && (
                      <div className="grid shrink-0 place-items-center text-teal-600 dark:text-teal-400">
                        <ArrowDown size={18} className="lg:hidden" />
                        <ArrowRight size={18} className="hidden lg:block" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <SectionHeading title="Wallet Funding & Cashout Loop" subtitle="Runs independently of the order flow above — every Reseller and Merchant wallet feeds from here." />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {walletLoop.map((col) => (
            <div key={col.title} className={`card p-4 sm:p-5 ${tones[col.tone]}`}>
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

      <section className="mt-10 mb-4">
        <SectionHeading title="Admin Oversight" subtitle="Not a flow — this is what Admin is watching day to day while the above runs." />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminGroups.map((group) => (
            <div key={group.title} className="card p-4">
              <div className="flex items-center gap-2 text-fg-muted">
                <ShieldAlert size={16} />
                <h3 className="font-display text-sm font-extrabold text-fg">{group.title}</h3>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-5 text-fg-muted">
                {group.items.map((item) => <li key={item}>· {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
