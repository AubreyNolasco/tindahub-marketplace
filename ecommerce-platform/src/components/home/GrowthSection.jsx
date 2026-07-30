import { ArrowDown, ArrowRight, BadgeCheck, BarChart3, Boxes, Building2, Handshake, Megaphone, PackageCheck, ReceiptText, Share2, ShieldCheck, ShoppingBag, Store, TrendingUp, UserPlus, UsersRound, WalletCards, Stethoscope, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'

const merchantBenefits = [
  { icon: Store, title: 'Build your digital store', text: 'List products, manage inventory, and present your business to active Resellers.' },
  { icon: Megaphone, title: 'Join sales campaigns', text: 'Take part in Payday and Double Day offers to attract more buyers.' },
  { icon: BarChart3, title: 'Make informed decisions', text: 'Follow your recommended next action, monitor performance, and print transaction records.' }
]

const resellerBenefits = [
  { icon: ShoppingBag, title: 'Choose products worth selling', text: 'Browse approved Merchants, check stock and reseller pricing, and pick items that fit your audience.' },
  { icon: Share2, title: 'Sell on your social network', text: 'Promote your chosen products on Facebook, Messenger, TikTok, or your preferred selling channel.' },
  { icon: TrendingUp, title: 'Turn orders into income', text: 'Follow your next action, record customers, track fulfillment, and keep printable records.' }
]

const clinicFeatures = [
  { icon: Stethoscope, title: 'Partner Clinics', text: 'Dental and Optical clinics offering a referral fee for every completed appointment.' },
  { icon: UsersRound, title: 'Refer Your Customer', text: 'Use your saved customer list or enter details manually to make a referral.' },
  { icon: WalletCards, title: 'Auto-Payout', text: 'The referral fee is automatically transferred from the clinic wallet to your wallet.' }
]

const realEstateFeatures = [
  { icon: Building2, title: 'Partner Agents', text: 'Real estate agents with verified properties for condos, house and lot, and commercial spaces.' },
  { icon: UsersRound, title: 'Refer a Buyer', text: 'Refer your customer who is looking for a property — no upfront cost to you.' },
  { icon: WalletCards, title: 'Referral Fee', text: 'Earn a referral fee after a successful property viewing or transaction.' }
]

export default function GrowthSection() {
  return <>
    {/* MERCHANT-RESELLER GROWTH SECTION */}
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="relative order-2 lg:order-1">
          <div className="absolute -inset-3 -rotate-2 rounded-[2rem] bg-mango-100" />
          <div className="relative overflow-hidden rounded-[1.75rem] shadow-2xl shadow-teal-900/15">
            <img
              src="/hero/filipino-fruit-stand-vendor.jpg"
              alt="Filipino small business vendor at a market stall"
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-teal-950/60 via-transparent to-transparent" />
          </div>
          <div className="absolute -bottom-5 left-4 right-4 grid grid-cols-2 gap-2 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-xl backdrop-blur sm:left-8 sm:right-auto sm:w-[360px] sm:p-4">
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-100 text-teal-700"><Store size={17} /></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-ink/35">Merchant</p><p className="text-xs font-bold text-ink">Reach buyers</p></div></div>
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mango-100 text-mango-700"><UsersRound size={17} /></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-ink/35">Reseller</p><p className="text-xs font-bold text-ink">Find products</p></div></div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">One marketplace, many opportunities</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">Turn a trusted connection into real growth.</h2>
          <p className="mt-5 text-base leading-7 text-ink/60">JOM HUB brings Filipino Merchants and Resellers together in one organized workspace. Sell with greater visibility, source with confidence, and manage every transaction with clearer tools.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4"><p className="flex items-center gap-2 font-bold text-teal-900"><BadgeCheck size={18} /> Trusted community</p><p className="mt-1 text-xs leading-5 text-ink/55">Admin-reviewed accounts for safer business relationships.</p></div>
            <div className="rounded-2xl border border-mango-200 bg-mango-100/60 p-4"><p className="flex items-center gap-2 font-bold text-ink"><PackageCheck size={18} className="text-mango-700" /> Clear fulfillment</p><p className="mt-1 text-xs leading-5 text-ink/55">Track orders from placement through delivery confirmation.</p></div>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link to="/signup" className="btn-primary inline-flex items-center justify-center gap-2">Start growing <ArrowRight size={17} /></Link><Link to="/catalog" className="btn-secondary inline-flex items-center justify-center gap-2">Explore the marketplace</Link></div>
        </div>
      </div>
    </section>

    {/* CHOOSE YOUR PATH */}
    <section className="bg-[linear-gradient(180deg,#EDF7F1_0%,#FFFFFF_48%,#F7FAF7_100%)] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative z-10 mx-auto max-w-3xl rounded-[1.75rem] border border-teal-100 bg-surface px-5 py-7 text-center shadow-lg shadow-teal-900/[0.05] sm:px-10 sm:py-9">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-mango-600">Choose your path</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-[#073B25] sm:text-4xl">Built for both sides of a growing marketplace.</h2>
          <p className="mx-auto mt-4 max-w-2xl font-medium leading-7 text-[#405249]">Whether you already have products or are ready to resell, JOM HUB gives you a focused workspace for your next step.</p>
        </div>

        {/* Four Paths: Merchant | Reseller | Clinic | Real Estate */}
        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-4">
          <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-teal-100 bg-surface shadow-card transition hover:-translate-y-1 hover:shadow-xl">
            <div className="min-h-[180px] bg-gradient-to-r from-teal-950 to-teal-700 p-5 text-white sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Store size={24} className="text-mango-300" /></span>
              <h3 className="mt-4 font-display text-2xl font-bold">For Merchants</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">Put your products in front of Resellers and run your store from one secure hub.</p>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div className="flex-1 space-y-4">{merchantBenefits.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={18} /></span><div><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-6 text-ink/60">{text}</p></div></div>)}</div>
              <Link to="/signup" className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2">Register as a Merchant <ArrowRight size={16} /></Link>
            </div>
          </article>

          <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-mango-300 bg-surface shadow-card transition hover:-translate-y-1 hover:shadow-xl">
            <div className="relative min-h-[180px] overflow-hidden bg-gradient-to-br from-mango-300 via-mango-500 to-mango-600 p-5 text-[#142019] sm:p-8">
              <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/25 blur-2xl" />
              <div className="relative z-10">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/40 bg-white/35 shadow-sm"><UsersRound size={24} /></span>
                <h3 className="mt-4 font-display text-2xl font-extrabold">For Resellers</h3>
                <p className="mt-2 max-w-lg text-sm font-semibold leading-6 text-[#283B31]">Start selling without owning any products. Find trusted items, promote them to your network, and manage every order.</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div className="flex-1 space-y-4">{resellerBenefits.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mango-100 text-mango-600"><Icon size={18} /></span><div><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-6 text-ink/60">{text}</p></div></div>)}</div>
              <Link to="/signup" className="btn-accent mt-6 inline-flex w-full items-center justify-center gap-2">Start reselling <ArrowRight size={16} /></Link>
            </div>
          </article>

          <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-teal-100 bg-surface shadow-card transition hover:-translate-y-1 hover:shadow-xl">
            <div className="min-h-[180px] bg-gradient-to-r from-teal-700 to-teal-950 p-5 text-white sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Stethoscope size={24} className="text-mango-300" /></span>
              <h3 className="mt-4 font-display text-2xl font-bold">Clinic Referrals</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">Refer your customer to a partner dental or optical clinic and earn a referral fee.</p>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div className="flex-1 space-y-4">{clinicFeatures.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={18} /></span><div><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-6 text-ink/60">{text}</p></div></div>)}</div>
              <Link to="/clinics" className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2">View partner clinics <ArrowRight size={16} /></Link>
            </div>
          </article>

          <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-teal-100 bg-surface shadow-card transition hover:-translate-y-1 hover:shadow-xl">
            <div className="min-h-[180px] bg-gradient-to-r from-teal-950 to-teal-800 p-5 text-white sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Building2 size={24} className="text-mango-300" /></span>
              <h3 className="mt-4 font-display text-2xl font-bold">Real Estate</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">Refer your customer to a partner real estate agent and earn a referral fee.</p>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div className="flex-1 space-y-4">{realEstateFeatures.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mango-100 text-mango-600"><Icon size={18} /></span><div><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-6 text-ink/60">{text}</p></div></div>)}</div>
              <Link to="/clinics" className="btn-accent mt-6 inline-flex w-full items-center justify-center gap-2">View properties <ArrowRight size={16} /></Link>
            </div>
          </article>
        </div>
      </div>
    </section>

    {/* RESELLER PLAYBOOK */}
    <section className="border-y border-black/5 bg-cream px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl"><div className="mx-auto max-w-3xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-mango-600">Your reseller playbook</p><h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-teal-950 sm:text-4xl">From a social media post to a completed customer order.</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-ink/60">You focus on finding customers and building relationships. JOM HUB provides the products, order workspace, and records for a more professional operation.</p></div>
        <div className="relative mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[{ icon: ShoppingBag, number: '01', title: 'Get products', text: 'Sign in, browse the protected Merchant Catalog, and add items to My Product List.' },
            { icon: Share2, number: '02', title: 'Build your store', text: 'Set your store name, profile and cover photos, introduction, and contact channels.' },
            { icon: UserPlus, number: '03', title: 'Share your link', text: 'Customers find your selected products and can contact you directly.' },
            { icon: ReceiptText, number: '04', title: 'Record the order', text: 'After confirming the customer, quantity, and details, place the protected JOM HUB order.' }
          ].map(({ icon: Icon, number, title, text }, index) => <div key={title} className="relative rounded-2xl border border-black/[0.06] bg-surface p-5 shadow-card"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mango-100 text-mango-600"><Icon size={20} /></span><span className="font-display text-3xl font-extrabold text-teal-900/10">{number}</span></div><h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/55">{text}</p>{index < 3 && <span className="absolute -right-5 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-teal-100 bg-surface text-teal-600 shadow-sm lg:flex"><ArrowRight size={17} /></span>}</div>)}
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-teal-50 p-4 text-center"><p className="font-display text-xl font-bold text-teal-800">Curated products</p><p className="mt-1 text-xs text-ink/50">Only products a Reseller has selected from the Merchant Catalog.</p></div>
          <div className="rounded-xl bg-mango-100/70 p-4 text-center"><p className="font-display text-xl font-bold text-ink">Unique store link</p><p className="mt-1 text-xs text-ink/50">A readable store-name URL for every Reseller.</p></div>
          <div className="rounded-xl bg-teal-50 p-4 text-center"><p className="font-display text-xl font-bold text-teal-800">Customer-safe view</p><p className="mt-1 text-xs text-ink/50">No access to the main system navigation from the customer store view.</p></div>
        </div>
        <div className="mt-8 text-center"><Link to="/signup" className="btn-accent inline-flex items-center justify-center gap-2 px-7 py-3.5">Register as a Reseller <ArrowRight size={17} /></Link><p className="mt-3 text-xs text-ink/40">Choose your products. Build your audience. Grow one order at a time.</p></div>
      </div>
    </section>

    {/* FAIR GROWTH MODEL */}
    <section className="border-y border-black/5 bg-surface px-4 py-16 sm:px-6 sm:py-20"><div className="mx-auto max-w-7xl"><div className="mx-auto max-w-3xl text-center"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-teal-600">A fair growth model</p><h2 className="mt-3 font-display text-3xl font-extrabold text-teal-950 sm:text-4xl">Clear value for every side of the marketplace.</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-ink/60">Merchants gain distribution, Resellers get room to earn, and JOM HUB earns transparent fees to keep the platform secure and running.</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-teal-100 bg-teal-50 p-6"><Store className="text-teal-700"/><h3 className="mt-4 font-display text-xl font-bold">Merchants earn</h3><p className="mt-2 text-sm leading-6 text-ink/60">Set wholesale and suggested retail prices, reach active Resellers, and receive net proceeds after a 3% fee on completed orders.</p></article>
        <article className="rounded-3xl border border-mango-300 bg-mango-100/60 p-6"><TrendingUp className="text-mango-700"/><h3 className="mt-4 font-display text-xl font-bold">Resellers see opportunity</h3><p className="mt-2 text-sm leading-6 text-ink/60">Compare buying price against the suggested customer price before promoting. A projected gross margin of at least 15% is protected.</p></article>
        <article className="rounded-3xl border border-teal-800 bg-teal-950 p-6 text-white"><ShieldCheck className="text-mango-300"/><h3 className="mt-4 font-display text-xl font-bold">JOM HUB stays reliable</h3><p className="mt-2 text-sm leading-6 text-white/65">Merchant subscriptions and transparent transaction fees support the database, storage, security, reports, and continuous platform operations.</p></article>
      </div>
      <p className="mt-5 text-center text-xs text-ink/40">Projected margins are estimates — not guaranteed income. Actual results depend on selling price, delivery, marketing, returns, and taxes.</p></div>
    </section>

    {/* JOM HUB CONNECTION */}
    <section className="bg-surface px-4 py-16 sm:px-6 sm:py-20">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-teal-100 bg-teal-950 px-5 py-8 text-white shadow-2xl shadow-teal-950/15 sm:px-8 sm:py-10 lg:px-10">
        <div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" /><div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-mango-400/15 blur-3xl" />
        <div className="relative text-center"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-mango-300"><Handshake size={15} /> The JOM HUB connection</span><h2 className="mx-auto mt-4 max-w-2xl font-display text-2xl font-extrabold sm:text-3xl">From trusted products to growing sales — in one connected flow.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">Merchants supply. JOM HUB organizes and protects. Resellers bring the products closer to the customer.</p></div>
        <div className="relative mx-auto mt-8 grid max-w-5xl items-stretch gap-3 md:grid-cols-[1fr_44px_1fr_44px_1fr] md:gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-5 backdrop-blur"><div className="flex items-center gap-3 md:block md:text-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-black/10 md:mx-auto"><Store size={23} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-200">Step 1</p><h3 className="mt-0.5 font-display text-lg font-bold">Merchants supply</h3></div></div><p className="mt-3 text-sm leading-6 text-white/60 md:text-center">List products, stock, pricing, and quantity offers for approved buyers.</p></div>
          <div className="flex items-center justify-center py-1 text-mango-300"><ArrowDown size={22} className="md:hidden" /><ArrowRight size={24} className="hidden md:block" /></div>
          <div className="relative rounded-2xl border border-mango-300/30 bg-gradient-to-br from-teal-700 to-teal-900 p-5 shadow-xl"><span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" /><div className="flex items-center gap-3 md:block md:text-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mango-300 text-ink shadow-lg shadow-black/10 md:mx-auto"><ShieldCheck size={23} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mango-200">Step 2</p><h3 className="mt-0.5 font-display text-lg font-bold">JOM HUB connects</h3></div></div><p className="mt-3 text-sm leading-6 text-white/70 md:text-center">Organizes discovery, secure access, orders, payments, communication, and reports.</p></div>
          <div className="flex items-center justify-center py-1 text-mango-300"><ArrowDown size={22} className="md:hidden" /><ArrowRight size={24} className="hidden md:block" /></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-5 backdrop-blur"><div className="flex items-center gap-3 md:block md:text-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mango-500 text-ink shadow-lg shadow-black/10 md:mx-auto"><UsersRound size={23} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mango-200">Step 3</p><h3 className="mt-0.5 font-display text-lg font-bold">Resellers grow</h3></div></div><p className="mt-3 text-sm leading-6 text-white/60 md:text-center">Find reliable products, serve customers, and build repeat sales.</p></div>
        </div>
        <div className="relative mx-auto mt-5 flex max-w-3xl flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-4 py-4 text-center sm:flex-row sm:gap-3"><PackageCheck size={20} className="shrink-0 text-mango-300" /><p className="text-sm font-semibold text-white/80">Completed orders build trust, stronger partnerships, and more opportunities for both sides.</p></div>
      </div>
    </section>
  </>
}
