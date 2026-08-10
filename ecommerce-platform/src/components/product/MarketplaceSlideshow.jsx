import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ShoppingBag, Store, Tags } from 'lucide-react'

const ROTATE_MS = 6000
const SLIDES = [
  {
    eyebrow: 'Wholesale marketplace',
    title: 'Everyday essentials, ready for business.',
    text: 'Source practical products from verified Filipino merchants with transparent stock and quantity pricing.',
    button: 'Shop products',
    to: '/marketplace',
    icon: ShoppingBag,
  },
  {
    eyebrow: 'Product deals',
    title: 'Buy smarter with real quantity discounts.',
    text: 'Compare campaign offers and wholesale tiers while keeping your expected reseller margin visible.',
    button: 'View product deals',
    to: '/marketplace?tab=products&discount=1',
    icon: Tags,
  },
  {
    eyebrow: 'Verified partners',
    title: 'Build reliable supplier relationships.',
    text: 'Discover admin-reviewed stores and manage every order through one organized marketplace workflow.',
    button: 'Browse stores',
    to: '/marketplace?tab=stores',
    icon: Store,
  },
]

export default function MarketplaceSlideshow() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % SLIDES.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [])

  const slide = SLIDES[index]
  const Icon = slide.icon

  return (
    <section className="relative aspect-[16/8] min-h-[300px] overflow-hidden rounded-2xl border border-line shadow-2xl sm:aspect-[16/7] lg:aspect-[16/6]" aria-roledescription="carousel" aria-label="Marketplace highlights">
      <img src="/assets/backgrounds/marketplace-slide-light.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center dark:hidden" />
      <img src="/assets/backgrounds/marketplace-slide-dark.jpg" alt="" className="absolute inset-0 hidden h-full w-full object-cover object-center dark:block" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/5 dark:from-[#00130c]/95 dark:via-[#002518]/72 dark:to-transparent" />
      <div key={index} className="relative flex h-full max-w-[65%] flex-col justify-center px-6 py-8 animate-fade-in sm:max-w-[58%] sm:px-9 lg:max-w-[52%] lg:px-12">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-600/15 bg-teal-600/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-teal-700 dark:text-emerald-300"><Icon size={13} /> {slide.eyebrow}</span>
        <h2 className="mt-4 font-display text-2xl font-extrabold leading-tight text-fg sm:text-3xl lg:text-4xl">{slide.title}</h2>
        <p className="mt-3 hidden max-w-lg text-sm leading-6 text-fg-muted sm:block">{slide.text}</p>
        <Link to={slide.to} className="mt-5 inline-flex w-fit items-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-900/15 transition hover:-translate-y-0.5 hover:bg-teal-500">{slide.button}</Link>
      </div>

      <button type="button" onClick={() => setIndex((current) => (current - 1 + SLIDES.length) % SLIDES.length)} className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/25 text-white backdrop-blur transition hover:bg-black/45" aria-label="Previous slide"><ChevronLeft size={18} /></button>
      <button type="button" onClick={() => setIndex((current) => (current + 1) % SLIDES.length)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/25 text-white backdrop-blur transition hover:bg-black/45" aria-label="Next slide"><ChevronRight size={18} /></button>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {SLIDES.map((item, dotIndex) => <button key={item.title} type="button" onClick={() => setIndex(dotIndex)} aria-label={`Go to slide ${dotIndex + 1}`} className={`h-2 rounded-full border border-white/30 transition-all ${dotIndex === index ? 'w-7 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'}`} />)}
      </div>
    </section>
  )
}
