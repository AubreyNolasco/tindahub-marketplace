import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react'

const ROTATE_MS = 6000

// Combines the live campaign-discount card (computed from real data —
// kept as its own always-first slide, not admin-editable, so the
// percentage/countdown shown can never drift from what's actually
// active) with whatever slides the admin configured in
// Admin/MarketplaceEditor.jsx (site_settings key="marketplace"). If
// there's only one slide total, it just renders statically — no
// pagination dots or rotation for a single item.
export default function MarketplaceSlideshow({ campaignSlide, customSlides }) {
  const slides = [...(campaignSlide ? [campaignSlide] : []), ...customSlides.filter((slide) => slide.visible !== false)]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index >= slides.length) setIndex(0)
  }, [slides.length, index])

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => setIndex((current) => (current + 1) % slides.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null
  const slide = slides[index]

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-card">
      {slide.kind === 'campaign' ? (
        <div className="relative bg-gradient-to-br from-coral-700 via-coral-600 to-mango-600 p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full border-[40px] border-white/10" />
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"><Zap size={13} />Mega Sale</p>
            <p className="mt-3 font-display text-2xl font-extrabold leading-tight sm:text-3xl">{slide.title}</p>
            {slide.countdown}
          </div>
        </div>
      ) : (
        <div className={`grid items-center gap-4 p-6 sm:p-8 ${slide.image_url ? 'sm:grid-cols-[1fr_240px]' : ''}`} style={{ background: slide.background || '#0B4D30', color: slide.text_color || '#FFFFFF' }}>
          <div>
            <p className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{slide.title}</p>
            {slide.text && <p className="mt-2 max-w-md text-sm leading-6 opacity-80">{slide.text}</p>}
            {slide.button_label && (
              <Link to={slide.button_link || '/marketplace'} className="mt-4 inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink hover:opacity-90">
                {slide.button_label}
              </Link>
            )}
          </div>
          {slide.image_url && <img src={slide.image_url} alt="" className="aspect-square w-full rounded-xl object-cover sm:aspect-[4/3]" />}
        </div>
      )}

      {slides.length > 1 && (
        <>
          <button type="button" onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/20 p-1.5 text-white transition hover:bg-black/35" aria-label="Previous slide">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setIndex((current) => (current + 1) % slides.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/20 p-1.5 text-white transition hover:bg-black/35" aria-label="Next slide">
            <ChevronRight size={18} />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`Go to slide ${dotIndex + 1}`}
                className={`h-2 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/75'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
