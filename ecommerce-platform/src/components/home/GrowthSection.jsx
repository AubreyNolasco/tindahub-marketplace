import { ArrowDown, ArrowRight, BadgeCheck, BarChart3, Boxes, Building2, Handshake, Megaphone, PackageCheck, ReceiptText, Share2, ShieldCheck, ShoppingBag, Store, TrendingUp, UserPlus, UsersRound, WalletCards, Stethoscope, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'

const merchantBenefits = [
  { icon: Store, title: 'Buuin ang iyong digital store', text: 'Maglista ng produkto, pamahalaan ang inventory, at i-present ang iyong negosyo sa mga aktibong reseller.' },
  { icon: Megaphone, title: 'Sumali sa sales campaigns', text: 'Makilahok sa Payday at Double Day offers para makahikayat ng mas maraming buyer.' },
  { icon: BarChart3, title: 'Gumawa ng informed decisions', text: 'Sundin ang recommended next action, i-monitor ang performance, at mag-print ng transaction records.' }
]

const resellerBenefits = [
  { icon: ShoppingBag, title: 'Pumili ng produktong worth it', text: 'Mag-browse sa mga approved merchant, tingnan ang stock at reseller pricing, at pumili ng bagay sa iyong audience.' },
  { icon: Share2, title: 'Ibenta sa iyong social network', text: 'I-promote ang napiling produkto sa Facebook, Messenger, TikTok, o sa iyong preferred selling channel.' },
  { icon: TrendingUp, title: 'Gawing kita ang customer orders', text: 'Sundin ang iyong next action, mag-record ng customers, i-track ang fulfillment, at mag-keep ng printable records.' }
]

const clinicFeatures = [
  { icon: Stethoscope, title: 'Partner Clinics', text: 'Dental at Optical clinics na nag-aalok ng referral fee para sa bawat kumpletong appointment.' },
  { icon: UsersRound, title: 'Refer Your Customer', text: 'Gamitin ang iyong saved customer list o mag-enter ng manual details para i-refer.' },
  { icon: WalletCards, title: 'Auto-Payout', text: 'Ang referral fee ay awtomatikong ililipat mula sa clinic wallet patungo sa iyong wallet.' }
]

const realEstateFeatures = [
  { icon: Building2, title: 'Partner Agents', text: 'Real estate agents na may verified properties para sa condo, house and lot, at commercial spaces.' },
  { icon: UsersRound, title: 'Refer a Buyer', text: 'I-refer ang iyong customer na naghahanap ng property — walang upfront cost sa iyo.' },
  { icon: WalletCards, title: 'Referral Fee', text: 'Kumita ng referral fee pagkatapos ng successful property viewing o transaction.' }
]

const deliveryFeatures = [
  { icon: Truck, title: 'Lalamove API', text: 'Ikonekta ang iyong Lalamove account para sa real-time delivery quotes.' },
  { icon: Boxes, title: 'Package Tracking', text: 'Subaybayan ang iyong delivery mula pick-up hanggang sa pagdating sa customer.' },
  { icon: BadgeCheck, title: 'Flexible Options', text: 'Pumili sa pagitan ng standard shipping at Lalamove same-day delivery.' }
]

export default function GrowthSection() {
  return <>
    {/* MERCHANT-RESELLER GROWTH SECTION */}
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="relative order-2 lg:order-1">
          <div className="absolute -inset-3 -rotate-2 rounded-[2rem] bg-mango-100" />
          <picture>
            <source media="(min-width: 1024px)" srcSet="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=85" />
            <source media="(min-width: 640px)" srcSet="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=800&q=80" />
            <img
              src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=600&q=70"
              alt="Filipino merchant and reseller growing their online business together"
              className="relative aspect-[4/3] w-full rounded-[1.75rem] object-cover shadow-2xl shadow-teal-900/15"
              loading="lazy"
            />
          </picture>
          <div className="absolute -bottom-5 left-4 right-4 grid grid-cols-2 gap-2 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-xl backdrop-blur sm:left-8 sm:right-auto sm:w-[360px] sm:p-4">
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-100 text-teal-700"><Store size={17} /></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-ink/35">Merchant</p><p className="text-xs font-bold text-ink">Maabot ang buyers</p></div></div>
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mango-100 text-mango-700"><UsersRound size={17} /></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-ink/35">Reseller</p><p className="text-xs font-bold text-ink">Maghanap ng produkto</p></div></div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Isang marketplace, maraming oportunidad</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">Gawing tunay na paglago ang pinagkakatiwalaang koneksyon.</h2>
          <p className="mt-5 text-base leading-7 text-ink/60">Pinagsasama ng JOM HUB ang mga Pilipinong merchant at reseller sa isang organized workspace. Magbenta nang may mas mataas na visibility, mag-source nang may kumpiyansa, at pamahalaan ang bawat transaksyon gamit ang mas malinaw na tools.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4"><p className="flex items-center gap-2 font-bold text-teal-900"><BadgeCheck size={18} /> Pinagkakatiwalaang komunidad</p><p className="mt-1 text-xs leading-5 text-ink/55">Admin-reviewed accounts para sa mas ligtas na business relationships.</p></div>
            <div className="rounded-2xl border border-mango-200 bg-mango-100/60 p-4"><p className="flex items-center gap-2 font-bold text-ink"><PackageCheck size={18} className="text-mango-700" /> Malinaw na fulfillment</p><p className="mt-1 text-xs leading-5 text-ink/55">Subaybayan ang orders mula placement hanggang delivery confirmation.</p></div>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link to="/signup" className="btn-primary inline-flex items-center justify-center gap-2">Simulan ang paglago <ArrowRight size={17} /></Link><Link to="/catalog" className="btn-secondary inline-flex items-center justify-center gap-2">I-explore ang marketplace</Link></div>
        </div>
      </div>
    </section>

    {/* CHOOSE YOUR PATH */}
    <section className="bg-[linear-gradient(180deg,#EDF7F1_0%,#FFFFFF_48%,#F7FAF7_100%)] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative z-10 mx-auto max-w-3xl rounded-[1.75rem] border border-teal-100 bg-white px-5 py-7 text-center shadow-lg shadow-teal-900/[0.05] sm:px-10 sm:py-9">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-mango-600">Pumili ng iyong landas</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-[#073B25] sm:text-4xl">Ginawa para sa magkabilang panig ng lumalagong marketplace.</h2>
          <p className="mx-auto mt-4 max-w-2xl font-medium leading-7 text-[#405249]">Kung mayroon ka nang produkto o handa ka nang mag-resell, binibigyan ka ng JOM HUB ng focused workspace para sa iyong susunod na hakbang.</p>
        </div>

        {/* Four Paths: Merchant | Reseller | Clinic | Real Estate */}
        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-4">
          <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-teal-100 bg-white shadow-card transition hover:-translate-y-1 hover:shadow-xl">
            <div className="min-h-[180px] bg-gradient-to-r from-teal-950 to-teal-700 p-5 text-white sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Store size={24} className="text-mango-300" /></span>
              <h3 className="mt-4 font-display text-2xl font-bold">Para sa Merchants</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">Ilagay ang iyong produkto sa harap ng mga reseller at patakbuhin ang iyong store mula sa isang secure hub.</p>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div className="flex-1 space-y-4">{merchantBenefits.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={18} /></span><div><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-6 text-ink/60">{text}</p></div></div>)}</div>
              <Link to="/signup" className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2">Mag-register bilang Merchant <ArrowRight size={16} /></Link>
            </div>
          </article>

          <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-mango-300 bg-white shadow-card transition hover:-translate-y-1 hover:shadow-xl">
            <div className="relative min-h-[180px] overflow-hidden bg-gradient-to-br from-mango-300 via-mango-500 to-mango-600 p-5 text-[#142019] sm:p-8">
              <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/25 blur-2xl" />
              <div className="relative z-10">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/40 bg-white/35 shadow-sm"><UsersRound size={24} /></span>
                <h3 className="mt-4 font-display text-2xl font-extrabold">Para sa Resellers</h3>
                <p className="mt-2 max-w-lg text-sm font-semibold leading-6 text-[#283B31]">Magsimulang magbenta nang walang sariling produkto. Humanap ng trusted items, i-promote sa iyong network, at pamahalaan ang bawat order.</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div className="flex-1 space-y-4">{resellerBenefits.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mango-100 text-mango-600"><Icon size={18} /></span><div><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-6 text-ink/60">{text}</p></div></div>)}</div>
              <Link to="/signup" className="btn-accent mt-6 inline-flex w-full items-center justify-center gap-2">Magsimulang mag-resell <ArrowRight size={16} /></Link>
            </div>
          </article>

          <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-teal-100 bg-white shadow-card transition hover:-translate-y-1 hover:shadow-xl">
            <div className="min-h-[180px] bg-gradient-to-r from-teal-700 to-teal-950 p-5 text-white sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Stethoscope size={24} className="text-mango-300" /></span>
              <h3 className="mt-4 font-display text-2xl font-bold">Clinic Referrals</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">I-refer ang iyong customer sa partner dental o optical clinic at kumita ng referral fee.</p>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div className="flex-1 space-y-4">{clinicFeatures.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={18} /></span><div><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-6 text-ink/60">{text}</p></div></div>)}</div>
              <Link to="/clinics" className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2">Tingnan ang mga clinic <ArrowRight size={16} /></Link>
            </div>
          </article>

          <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-teal-100 bg-white shadow-card transition hover:-translate-y-1 hover:shadow-xl">
            <div className="min-h-[180px] bg-gradient-to-r from-teal-950 to-teal-800 p-5 text-white sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Building2 size={24} className="text-mango-300" /></span>
              <h3 className="mt-4 font-display text-2xl font-bold">Real Estate</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">I-refer ang iyong customer sa partner real estate agents at kumita ng referral fee.</p>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div className="flex-1 space-y-4">{realEstateFeatures.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mango-100 text-mango-600"><Icon size={18} /></span><div><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-6 text-ink/60">{text}</p></div></div>)}</div>
              <Link to="/clinics" className="btn-accent mt-6 inline-flex w-full items-center justify-center gap-2">Tingnan ang properties <ArrowRight size={16} /></Link>
            </div>
          </article>
        </div>
      </div>
    </section>

    {/* RESELLER PLAYBOOK */}
    <section className="border-y border-black/5 bg-cream px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl"><div className="mx-auto max-w-3xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-mango-600">Iyong reseller playbook</p><h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-teal-950 sm:text-4xl">Mula social-media post hanggang sa kumpletong customer order.</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-ink/60">Ikaw ay mag-focus sa paghahanap ng customer at pagbuo ng relasyon. Ibinibigay ng JOM HUB ang mga produkto, order workspace, at records para sa mas propesyonal na operasyon.</p></div>
        <div className="relative mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[{ icon: ShoppingBag, number: '01', title: 'Kumuha ng produkto', text: 'Mag-sign in, mag-browse sa protected Merchant Catalog, at mag-add sa My Product List.' },
            { icon: Share2, number: '02', title: 'Buuin ang iyong store', text: 'Mag-set ng store name, profile at cover photos, introduction, at contact channels.' },
            { icon: UserPlus, number: '03', title: 'I-share ang iyong link', text: 'Ang mga customer ay makakahanap ng iyong selected products at makaka-contact sa iyo.' },
            { icon: ReceiptText, number: '04', title: 'I-record ang order', text: 'Pagkatapos kumpirmahin ang customer, quantity, at details, ilagay ang protected JOM HUB order.' }
          ].map(({ icon: Icon, number, title, text }, index) => <div key={title} className="relative rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mango-100 text-mango-600"><Icon size={20} /></span><span className="font-display text-3xl font-extrabold text-teal-900/10">{number}</span></div><h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/55">{text}</p>{index < 3 && <span className="absolute -right-5 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-teal-100 bg-white text-teal-600 shadow-sm lg:flex"><ArrowRight size={17} /></span>}</div>)}
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-teal-50 p-4 text-center"><p className="font-display text-xl font-bold text-teal-800">Curated products</p><p className="mt-1 text-xs text-ink/50">Tanging produkto na kinuha ng Reseller mula sa Merchant Catalog.</p></div>
          <div className="rounded-xl bg-mango-100/70 p-4 text-center"><p className="font-display text-xl font-bold text-ink">Unique store link</p><p className="mt-1 text-xs text-ink/50">Isang readable store-name URL para sa bawat Reseller.</p></div>
          <div className="rounded-xl bg-teal-50 p-4 text-center"><p className="font-display text-xl font-bold text-teal-800">Customer-safe view</p><p className="mt-1 text-xs text-ink/50">Walang access sa main system navigation mula sa customer store.</p></div>
        </div>
        <div className="mt-8 text-center"><Link to="/signup" className="btn-accent inline-flex items-center justify-center gap-2 px-7 py-3.5">Mag-rehistro bilang Reseller <ArrowRight size={17} /></Link><p className="mt-3 text-xs text-ink/40">Pumili ng produkto. Buuin ang iyong audience. Lumago isang order sa isang pagkakataon.</p></div>
      </div>
    </section>

    {/* FAIR GROWTH MODEL */}
    <section className="border-y border-black/5 bg-white px-4 py-16 sm:px-6 sm:py-20"><div className="mx-auto max-w-7xl"><div className="mx-auto max-w-3xl text-center"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-teal-600">Isang patas na growth model</p><h2 className="mt-3 font-display text-3xl font-extrabold text-teal-950 sm:text-4xl">Malinaw na halaga para sa bawat panig ng marketplace.</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-ink/60">Ang mga merchant ay nakakakuha ng distribution, ang reseller ay may room to earn, at ang JOM HUB ay kumikita ng transparent fees para sa pagpapanatili ng secure platform.</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-teal-100 bg-teal-50 p-6"><Store className="text-teal-700"/><h3 className="mt-4 font-display text-xl font-bold">Merchant ay kumikita</h3><p className="mt-2 text-sm leading-6 text-ink/60">Mag-set ng wholesale at suggested retail prices, maabot ang mga aktibong Reseller, at makatanggap ng net proceeds pagkatapos ng 3% fee sa completed orders.</p></article>
        <article className="rounded-3xl border border-mango-300 bg-mango-100/60 p-6"><TrendingUp className="text-mango-700"/><h3 className="mt-4 font-display text-xl font-bold">Reseller ay nakakakita ng oportunidad</h3><p className="mt-2 text-sm leading-6 text-ink/60">Ikumpara ang buying price sa suggested customer price bago mag-promote. Protektado ang hindi bababa sa 15% projected gross margin.</p></article>
        <article className="rounded-3xl border border-teal-800 bg-teal-950 p-6 text-white"><ShieldCheck className="text-mango-300"/><h3 className="mt-4 font-display text-xl font-bold">JOM HUB ay nananatiling reliable</h3><p className="mt-2 text-sm leading-6 text-white/65">Ang merchant subscriptions at transparent transaction fees ay sumusuporta sa database, storage, security, reports, at continuous platform operations.</p></article>
      </div>
      <p className="mt-5 text-center text-xs text-ink/40">Ang projected margins ay estimates — hindi garantisadong kita. Ang actual results ay depende sa selling price, delivery, marketing, returns, at taxes.</p></div>
    </section>

    {/* JOM HUB CONNECTION */}
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-teal-100 bg-teal-950 px-5 py-8 text-white shadow-2xl shadow-teal-950/15 sm:px-8 sm:py-10 lg:px-10">
        <div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" /><div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-mango-400/15 blur-3xl" />
        <div className="relative text-center"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-mango-300"><Handshake size={15} /> Ang JOM HUB connection</span><h2 className="mx-auto mt-4 max-w-2xl font-display text-2xl font-extrabold sm:text-3xl">Mula sa pinagkakatiwalaang produkto hanggang sa lumalagong benta—sa isang connected flow.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">Ang mga merchant ay nag-supply. Ang JOM HUB ay nag-organize at nag-protekta. Ang mga reseller ay nagdadala ng produkto palapit sa customer.</p></div>
        <div className="relative mx-auto mt-8 grid max-w-5xl items-stretch gap-3 md:grid-cols-[1fr_44px_1fr_44px_1fr] md:gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-5 backdrop-blur"><div className="flex items-center gap-3 md:block md:text-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-black/10 md:mx-auto"><Store size={23} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-200">Step 1</p><h3 className="mt-0.5 font-display text-lg font-bold">Merchant ay nag-supply</h3></div></div><p className="mt-3 text-sm leading-6 text-white/60 md:text-center">Naglista ng produkto, stock, pricing, at quantity offers para sa approved buyers.</p></div>
          <div className="flex items-center justify-center py-1 text-mango-300"><ArrowDown size={22} className="md:hidden" /><ArrowRight size={24} className="hidden md:block" /></div>
          <div className="relative rounded-2xl border border-mango-300/30 bg-gradient-to-br from-teal-700 to-teal-900 p-5 shadow-xl"><span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" /><div className="flex items-center gap-3 md:block md:text-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mango-300 text-ink shadow-lg shadow-black/10 md:mx-auto"><ShieldCheck size={23} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mango-200">Step 2</p><h3 className="mt-0.5 font-display text-lg font-bold">JOM HUB ay nagkokonekta</h3></div></div><p className="mt-3 text-sm leading-6 text-white/70 md:text-center">Nag-organize ng discovery, secure access, orders, payments, communication, at reports.</p></div>
          <div className="flex items-center justify-center py-1 text-mango-300"><ArrowDown size={22} className="md:hidden" /><ArrowRight size={24} className="hidden md:block" /></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-5 backdrop-blur"><div className="flex items-center gap-3 md:block md:text-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mango-500 text-ink shadow-lg shadow-black/10 md:mx-auto"><UsersRound size={23} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mango-200">Step 3</p><h3 className="mt-0.5 font-display text-lg font-bold">Reseller ay lumalago</h3></div></div><p className="mt-3 text-sm leading-6 text-white/60 md:text-center">Nakakahanap ng reliable products, nagse-serve ng customers, at bumubuo ng repeat sales.</p></div>
        </div>
        <div className="relative mx-auto mt-5 flex max-w-3xl flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-4 py-4 text-center sm:flex-row sm:gap-3"><PackageCheck size={20} className="shrink-0 text-mango-300" /><p className="text-sm font-semibold text-white/80">Ang mga kumpletong order ay bumubuo ng tiwala, mas matatag na partnership, at mas maraming oportunidad para sa magkabilang panig.</p></div>
      </div>
    </section>
  </>
}
