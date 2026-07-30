import {
  ArrowDown, BadgeCheck, Building2, CheckCircle2, CircleDollarSign,
  ExternalLink, PackageCheck, Printer, RefreshCw, ShieldCheck,
  ShoppingBag, Store, Truck, UserRound, WalletCards
} from 'lucide-react'

const lanes = [
  {
    title: '1. Account & Access',
    subtitle: 'How each role enters the system',
    tone: 'teal',
    steps: [
      { icon: UserRound, role: 'User', title: 'Choose a role', text: 'Register as Merchant or Reseller.' },
      { icon: ShieldCheck, role: 'Admin', title: 'Review account', text: 'Merchant permit and subscription payment are reviewed. Resellers have no subscription fee.' },
      { icon: BadgeCheck, role: 'System', title: 'Open the workspace', text: 'Approved users enter the dashboard for their assigned role.' }
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
    subtitle: 'Customer contacts the reseller outside the main system',
    tone: 'violet',
    steps: [
      { icon: UserRound, role: 'Customer', title: 'Open reseller link', text: 'The customer sees only that reseller’s selected available products.' },
      { icon: ShoppingBag, role: 'Customer', title: 'Choose a product', text: 'The How to Buy popup explains the next step and safety reminders.' },
      { icon: ExternalLink, role: 'Customer', title: 'Contact the reseller', text: 'Continue through Facebook, phone, Viber, or WhatsApp, depending on availability.' }
    ]
  },
  {
    title: '5. Order, Payment & Delivery',
    subtitle: 'Transaction moves from reseller to fulfillment',
    tone: 'blue',
    steps: [
      { icon: WalletCards, role: 'Reseller', title: 'Fund and place order', text: 'Use wallet funds to order the required quantity from the Merchant.' },
      { icon: CircleDollarSign, role: 'System', title: 'Record payment', text: 'Track product cost, platform fee, collection status, and reseller margin.' },
      { icon: Truck, role: 'Merchant', title: 'Fulfill delivery', text: 'Merchant prepares the item and updates the delivery milestones.' },
      { icon: CheckCircle2, role: 'System', title: 'Complete the order', text: 'Completion updates reports, wallet records, inventory, and sales history.' }
    ]
  }
]

const tones = {
  teal: 'border-teal-200 bg-teal-50 text-teal-800',
  mango: 'border-mango-200 bg-mango-50 text-mango-800',
  coral: 'border-coral-200 bg-coral-50 text-coral-800',
  violet: 'border-violet-200 bg-violet-50 text-violet-800',
  blue: 'border-sky-200 bg-sky-50 text-sky-800'
}

const roleTones = {
  Admin: 'bg-slate-800 text-white',
  Merchant: 'bg-mango-100 text-mango-800',
  Reseller: 'bg-coral-100 text-coral-800',
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
          <button type="button" onClick={() => window.print()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm font-bold text-teal-900 transition hover:bg-mango-100 print:hidden">
            <Printer size={17} /> Print flowchart
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

      <aside className="mt-6 rounded-2xl border border-mango-200 bg-mango-50 p-5">
        <div className="flex items-start gap-3">
          <RefreshCw size={20} className="mt-0.5 shrink-0 text-mango-700" />
          <div>
            <h2 className="font-display font-bold text-ink">Important cycle</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              After completion, updated stock and sales reports return to Merchant and Admin monitoring. The Reseller can continue selecting products and serving customers through the same unique storefront link.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
