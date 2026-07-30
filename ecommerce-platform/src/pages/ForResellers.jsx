import { Link } from 'react-router-dom'
import { ArrowRight, Clock3, CircleDollarSign, FileImage, Wallet } from 'lucide-react'
import SiteSubNav from '../components/home/SiteSubNav'
import useHomeContent from '../hooks/useHomeContent'

export default function ForResellers() {
  const content = useHomeContent()

  return <div className="overflow-hidden bg-bg">
    <SiteSubNav />

    {content.sections?.topup !== false && <section className="py-10 sm:py-16" id="topup">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div className="rounded-[1.75rem] bg-mango-100/60 p-6 dark:bg-mango-500/10 sm:p-8"><div className="grid gap-3 sm:grid-cols-2">{[{ icon: CircleDollarSign, title: 'Scan and pay', text: 'Use the JOM HUB InstaPay QR to pay AUBREY NOLASCO and enter the amount.' }, { icon: FileImage, title: 'Upload proof', text: 'Upload the screenshot along with the one-use reference number.' }, { icon: Clock3, title: 'Admin verification', text: 'Admin matches the actual payment; duplicate references are blocked.' }, { icon: Wallet, title: 'Wallet credit', text: 'Approved funds appear in your wallet balance.' }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl bg-surface p-5 shadow-sm"><Icon size={20} className="text-mango-600" /><h3 className="mt-3 font-bold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-ink/55">{text}</p></div>)}</div></div>
        <div><span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold text-mango-600"><Wallet size={14} /> For Resellers</span><h1 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">How Reseller registration works</h1><p className="mt-4 leading-7 text-ink/60">Enter your Gmail, type the 6-digit OTP, select Reseller, and complete your contact and delivery address. You'll land in your dashboard right away — no top-up required to finish signing up.</p><div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50 p-5 dark:border-teal-800 dark:bg-teal-500/10"><p className="font-semibold text-teal-900 dark:text-teal-300">Once you're fully approved</p><p className="mt-1 text-sm leading-6 text-ink/60">Verify your identity and top up your wallet (shown here) whenever you're ready — placing orders and managing customers unlocks once Admin approves both.</p></div><Link to="/signup" className="mt-7 inline-flex items-center gap-2 font-semibold text-teal-700">Register as a Reseller <ArrowRight size={17} /></Link></div>
      </div>
    </section>}
  </div>
}
