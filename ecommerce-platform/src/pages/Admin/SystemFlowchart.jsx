import { Link } from 'react-router-dom'
import {
  ArrowDown, ArrowRight, BadgeCheck, Building2, CheckCircle2, CircleDollarSign,
  ExternalLink, Network, PackageCheck, Printer, RefreshCw, ShieldCheck,
  ShoppingBag, Store, Truck, UserRound, WalletCards
} from 'lucide-react'

const lanes = [
  {
    title: '1. Account & Access',
    subtitle: 'How each role enters the system',
    tone: 'teal',
    steps: [
      { icon: UserRound, role: 'User', title: 'Register & choose a role', text: 'Verify Gmail with a 6-digit OTP, then choose Merchant or Reseller and complete the profile.' },
      { icon: BadgeCheck, role: 'System', title: 'Dashboard opens immediately', text: 'No waiting for approval -- the account lands in its dashboard right away and can browse freely from the start.' },
      { icon: ShieldCheck, role: 'Admin', title: 'Review requirements', text: 'Merchant permit + subscription, or Reseller ID verification + wallet top-up (submitted whenever ready, not required at signup), are reviewed. A Merchant may request temporary access while the permit is pending.' },
      { icon: PackageCheck, role: 'System', title: 'Unlock full operations', text: 'Posting products or placing orders stays locked until Admin approves -- or a temporary access window is active. Admin can suspend an already-approved account at any time.' }
    ]
  },
  {
    title: '2. Product Supply',
    subtitle: 'Merchant creates the available inventory',
    tone: 'mango',
    steps: [
      { icon: Building2, role: 'Merchant', title: 'Add a product', text: 'Set product details, photos, stock, wholesale price, and retail price.' },
      { icon: ShieldCheck, role: 'Admin', title: 'Monitor listings', text: 'Review products and prohibited content when intervention is needed.' },
      { icon: PackageCheck, role: 'System', title: 'Publish to catalog', text: 'Eligible products become available to signed-in resellers.' }
    ]
  },
  {
    title: '3. Reseller Storefront',
    subtitle: 'Only products selected by the reseller appear',
    tone: 'coral',
    steps: [
      { icon: ShoppingBag, role: 'Reseller', title: 'Browse the catalog', text: 'Open a Merchant product and select “Get for My Product List”.' },
      { icon: Store, role: 'Reseller', title: 'Prepare the store', text: 'Set store name, profile photo, cover photo, and customer contact channels.' },
      { icon: ExternalLink, role: 'System', title: 'Create a unique link', text: 'The reseller receives a readable /store/store-name customer link.' }
    ]
  },
  {
    title: '4. Customer Purchase',
    subtitle: 'Customer can now order directly, or fall back to contacting the reseller',
    tone: 'violet',
    steps: [
      { icon: UserRound, role: 'Customer', title: 'Open reseller link', text: 'The customer sees only that reseller’s selected available products.' },
      { icon: ShoppingBag, role: 'Customer', title: 'Open a product & order', text: 'Product detail popup, then an order form (qty, name, phone, address) submits a request straight to the reseller — no account needed.' },
      { icon: ExternalLink, role: 'Customer', title: 'Or contact the reseller', text: 'Facebook, phone, Viber, or WhatsApp remain available as a secondary fallback inside the same popup.' },
      { icon: PackageCheck, role: 'Reseller', title: 'Review in Customer Orders', text: 'Accept or decline the request in the Reseller’s own inbox, with the customer’s contact/address attached.' }
    ]
  },
  {
    title: '5. Order, Payment & Delivery',
    subtitle: 'Transaction moves from reseller to fulfillment',
    tone: 'blue',
    steps: [
      { icon: WalletCards, role: 'Reseller', title: 'Fund and place order', text: 'From a wholesale catalog purchase, or an accepted customer request converted into cart — either way, the same wallet-funded checkout places the order with the Merchant.' },
      { icon: CircleDollarSign, role: 'System', title: 'Record payment', text: 'Track product cost, platform fee, collection status, and reseller margin.' },
      { icon: Truck, role: 'Merchant', title: 'Fulfill delivery', text: 'Merchant prepares the item and updates the delivery milestones.' },
      { icon: CheckCircle2, role: 'System', title: 'Complete the order', text: 'Completion updates reports, wallet records, inventory, and sales history.' }
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

export default function SystemFlowchart() {
  let stepNumber = 0
  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="rounded-3xl bg-gradient-to-br from-teal-950 via-teal-800 to-teal-600 p-5 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-mango-300">Admin reference</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">System Flowchart</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70 sm:text-base">
              End-to-end view of how Admin, Merchant, Reseller, Customer, and the system work together.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link to="/admin/system-flowchart/full" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mango-300 px-4 py-2.5 text-sm font-bold text-teal-950 transition hover:bg-mango-200">
              <Network size={17} /> View full system flowchart
            </Link>
            <button type="button" onClick={() => window.print()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm font-bold text-teal-900 transition hover:bg-mango-100">
              <Printer size={17} /> Print flowchart
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {Object.keys(roleTones).map((role) => <span key={role} className={`rounded-full px-3 py-1.5 text-xs font-bold ${roleTones[role]}`}>{role}</span>)}
        </div>
      </header>

      <div className="mt-8 space-y-8">
        {lanes.map((lane) => (
          <section key={lane.title}>
            <div className={`card p-4 sm:p-5 ${tones[lane.tone]}`}>
              <h2 className="font-display text-lg font-extrabold sm:text-xl">{lane.title}</h2>
              <p className="mt-1 text-xs opacity-80 sm:text-sm">{lane.subtitle}</p>
            </div>
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

      <aside className="card mt-8 mb-4 border-mango-500/25 bg-mango-500/10 p-5">
        <div className="flex items-start gap-3">
          <RefreshCw size={20} className="mt-0.5 shrink-0 text-mango-700 dark:text-mango-300" />
          <div>
            <h2 className="font-display font-bold text-fg">Important cycle</h2>
            <p className="mt-1 text-sm leading-6 text-fg-muted">
              After completion, updated stock and sales reports return to Merchant and Admin monitoring. The Reseller can continue selecting products and serving customers through the same unique storefront link.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
