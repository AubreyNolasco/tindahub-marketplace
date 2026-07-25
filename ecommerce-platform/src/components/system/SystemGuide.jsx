import { useState, useEffect } from 'react'
import {
  HelpCircle, X, Store, Search, ShoppingCart, Wallet, Package,
  Check, Stethoscope, Users, Send, Clock, DollarSign, Truck,
  Ruler, Calculator, MapPin, PackageCheck, ChevronRight, ExternalLink
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STEP_ICONS = {
  store: Store, search: Search, cart: ShoppingCart, wallet: Wallet,
  package: Package, check: Check, stethoscope: Stethoscope, users: Users,
  send: Send, clock: Clock, dollar: DollarSign, truck: Truck,
  ruler: Ruler, calculator: Calculator, 'map-pin': MapPin, 'package-check': PackageCheck
}

export default function SystemGuide({ pageKey = 'product-flow', trigger = null }) {
  const [open, setOpen] = useState(false)
  const [guide, setGuide] = useState(null)
  const [activeTab, setActiveTab] = useState('steps')

  useEffect(() => {
    if (!open || !pageKey) return
    supabase.rpc('get_app_guide', { p_page_key: pageKey }).then(({ data }) => {
      if (data) setGuide(data)
    })
  }, [open, pageKey])

  const finalTrigger = trigger || (
    <button
      onClick={() => setOpen(true)}
      className="grid h-9 w-9 place-items-center rounded-xl text-ink/40 hover:bg-teal-50 hover:text-teal-600 transition-colors"
      title="How this works"
    >
      <HelpCircle size={18} />
    </button>
  )

  return (
    <>
      {finalTrigger}
      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/65 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-gradient-to-br from-teal-950 to-teal-700 rounded-t-3xl px-6 pt-5 pb-5 text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-mango-300">System Guide</p>
                <h2 className="mt-1 font-display text-xl font-bold">{guide?.title || 'Loading...'}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="shrink-0 grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            {guide && (
              <div className="border-b border-black/[0.06] px-6">
                <div className="flex gap-6">
                  {[
                    { key: 'steps', label: 'How it works' },
                    { key: 'faqs', label: 'FAQs' }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`py-4 text-sm font-semibold border-b-2 transition ${
                        activeTab === tab.key
                          ? 'border-teal-600 text-teal-700'
                          : 'border-transparent text-ink/50 hover:text-ink'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="px-6 py-5">
              {!guide ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-ink/50">Loading guide...</p>
                </div>
              ) : activeTab === 'steps' ? (
                <div className="space-y-4">
                  {guide.content && (
                    <p className="text-sm leading-6 text-ink/60 mb-6">{guide.content}</p>
                  )}
                  {Array.isArray(guide.steps) && guide.steps.map((step, index) => {
                    const Icon = STEP_ICONS[step.icon] || HelpCircle
                    return (
                      <div key={index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
                            <Icon size={18} />
                          </span>
                          {index < guide.steps.length - 1 && (
                            <div className="mt-1 h-full w-0.5 bg-teal-100" />
                          )}
                        </div>
                        <div className="pb-6 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                              {step.step}
                            </span>
                            <h3 className="font-bold text-ink">{step.title}</h3>
                          </div>
                          <p className="mt-1.5 text-sm leading-6 text-ink/55 ml-8">{step.text}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(guide.faqs) && guide.faqs.length > 0 ? (
                    guide.faqs.map((faq, index) => (
                      <details key={index} className="group rounded-2xl border border-black/[0.06] overflow-hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 text-sm font-semibold text-ink hover:bg-cream/50">
                          {faq.q}
                          <ChevronRight size={16} className="shrink-0 text-ink/30 transition group-open:rotate-90" />
                        </summary>
                        <div className="px-4 pb-4">
                          <p className="text-sm leading-6 text-ink/60">{faq.a}</p>
                        </div>
                      </details>
                    ))
                  ) : (
                    <p className="text-sm text-ink/50 py-8 text-center">No FAQs available for this guide.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Contextual guide button that shows per page
// Simple hook-based version for inline use
export function PageGuideButton({ pageKey, label = 'Guide' }) {
  const [showGuide, setShowGuide] = useState(false)
  const [guideData, setGuideData] = useState(null)

  useEffect(() => {
    if (!showGuide || !pageKey) return
    supabase.rpc('get_app_guide', { p_page_key: pageKey }).then(({ data }) => {
      if (data) setGuideData(data)
    })
  }, [showGuide, pageKey])

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2"
      >
        <HelpCircle size={14} /> {label}
      </button>
      {showGuide && (
        <SystemGuide
          pageKey={pageKey}
          trigger={null}
          open={true}
          onClose={() => { setShowGuide(false); setGuideData(null) }}
        />
      )}
    </>
  )
}
