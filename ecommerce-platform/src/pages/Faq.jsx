import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import SiteSubNav from '../components/home/SiteSubNav'
import { faqs } from '../config/homeContent'

export default function Faq() {
  const [openFaq, setOpenFaq] = useState(null)

  return <div className="overflow-hidden bg-bg">
    <SiteSubNav />

    <section className="bg-[linear-gradient(180deg,#FFFFFF_0%,#EDF7F1_100%)] py-16 dark:bg-none dark:bg-bg sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">Frequently asked questions</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-teal-950 dark:text-ink sm:text-4xl">Have a question? Here are the answers.</h1>
          <p className="mt-4 text-sm leading-6 text-ink/60">Learn the essentials about JOM HUB — from signing up to earning referral fees.</p>
        </div>
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-black/[0.06] bg-surface shadow-sm transition hover:shadow-md">
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="flex w-full items-center justify-between px-5 py-4 text-left sm:px-6"
                aria-expanded={openFaq === index}
              >
                <span className="pr-4 font-display text-base font-bold text-ink sm:text-lg">{faq.q}</span>
                <ChevronDown
                  size={20}
                  className={`shrink-0 text-teal-600 transition-transform duration-300 ${openFaq === index ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className="border-t border-black/[0.04] px-5 py-4 sm:px-6">
                  <p className="text-sm leading-7 text-ink/65">{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-lg text-center">
          <p className="text-sm text-ink/50">Didn't find your answer? Contact our admin at <a href="mailto:nolascoaubrey32@gmail.com" className="font-semibold text-teal-700 underline">nolascoaubrey32@gmail.com</a></p>
        </div>
      </div>
    </section>
  </div>
}
