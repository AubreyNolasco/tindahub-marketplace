import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, MapPin, PackageCheck, Route, Truck, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const content = {
  merchant: {
    title: 'Merchant Delivery Booking Guide',
    intro: 'The Merchant books Lalamove or another delivery provider for each accepted order.',
    steps: [
      ['Confirm and prepare', 'Review the order and prepare the items according to their packed weight, dimensions, and handling requirements.'],
      ['Use the buyer address', 'Copy the delivery address from the order. It is private and may only be used to complete delivery.'],
      ['Submit the shipping fee', 'After packaging, enter the actual courier fee. The Reseller must accept it before dispatch can continue.'],
      ['Book and record dispatch', 'After acceptance, enter the courier, tracking number, pickup schedule, delivery estimate, and upload booking or dispatch proof.'],
      ['Protected completion', 'The receiver confirms after inspection or opens a case. Without a dispute, completion occurs seven days after estimated delivery.'],
    ],
  },
}

const icons = [ClipboardCheck, PackageCheck, Truck, Route, CheckCircle2]

export default function DeliveryProcessGuide({ audience }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const guide = content[audience]
  const key = user ? `rmhub_delivery_guide_${audience}_${user.id}` : ''

  useEffect(() => {
    if (!key) return
    setOpen(audience === 'merchant')
  }, [key, audience])

  const close = () => {
    setOpen(false)
  }

  if (!guide) return null

  return <>
    <button type="button" onClick={() => setOpen(true)} className="btn-secondary mb-5 inline-flex items-center gap-2 px-4 py-2 text-sm"><Truck size={17} /> Delivery process guide</button>
    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-scrim/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={guide.title}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-surface shadow-2xl">
        <div className="relative bg-gradient-to-br from-teal-950 to-teal-700 px-6 py-7 text-white sm:px-8">
          <button type="button" onClick={close} className="absolute right-5 top-5 rounded-xl bg-white/10 p-2 text-white/80 hover:bg-white/20" aria-label="Close delivery guide"><X size={19} /></button>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mango-500 text-ink"><Truck size={28} /></span>
          <h2 className="mt-5 pr-10 font-display text-2xl font-bold">{guide.title}</h2>
          <p className="mt-2 text-sm leading-6 text-teal-100">{guide.intro}</p>
        </div>
        <div className="p-6 sm:p-8">
          <div className="space-y-4">{guide.steps.map(([title, text], index) => { const Icon = icons[index] || MapPin; return <div key={title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 font-bold text-teal-700"><Icon size={18} /></span><div><p className="text-sm font-bold text-ink"><span className="mr-2 text-teal-600">{index + 1}.</span>{title}</p><p className="mt-1 text-sm leading-6 text-ink/55">{text}</p></div></div> })}</div>
          <div className="mt-6 rounded-2xl border border-mango-300 bg-mango-100/50 p-4 text-sm leading-6 text-ink/65"><strong className="text-ink">Important:</strong> Dispatch is locked until the Reseller accepts the submitted shipping fee. A decline requires a note. Shipping is paid directly to the courier and is not included in the JOM HUB wallet total.</div>
          <button type="button" onClick={close} className="btn-primary mt-6 w-full py-3">I understand the delivery process</button>
        </div>
      </div>
    </div>}
  </>
}
