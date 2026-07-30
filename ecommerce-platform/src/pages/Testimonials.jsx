import { useEffect, useState } from 'react'
import { Quote, Star } from 'lucide-react'
import SiteSubNav from '../components/home/SiteSubNav'
import { testimonials } from '../config/homeContent'

export default function Testimonials() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setActiveTestimonial((prev) => (prev + 1) % testimonials.length), 5000)
    return () => clearInterval(interval)
  }, [])

  return <div className="overflow-hidden bg-bg">
    <SiteSubNav />

    <section className="bg-[linear-gradient(180deg,#EDF7F1_0%,#FFFFFF_48%,#F7FAF7_100%)] py-16 dark:bg-none dark:bg-bg sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">What our community says</p>
          <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-teal-950 dark:text-ink sm:text-3xl">Trusted by Filipino entrepreneurs.</h1>
        </div>
        <div className="mt-10 mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-surface p-6 shadow-xl sm:p-10">
            <Quote size={40} className="absolute right-4 top-4 text-teal-100 sm:right-8 sm:top-8 sm:h-16 sm:w-16" />
            <div className="flex items-center gap-2 mb-4">
              {[0,1,2,3,4].map((star) => <Star key={star} size={16} className="fill-mango-500 text-mango-500" />)}
            </div>
            <p className="text-lg leading-8 text-ink/80 sm:text-xl sm:leading-9 font-medium italic">
              "{testimonials[activeTestimonial].text}"
            </p>
            <div className="mt-6 flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal-600 text-lg font-bold text-white">
                {testimonials[activeTestimonial].avatar}
              </span>
              <div>
                <p className="font-bold text-ink">{testimonials[activeTestimonial].name}</p>
                <p className="text-sm text-ink/50">{testimonials[activeTestimonial].role}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`h-2.5 rounded-full transition-all ${index === activeTestimonial ? 'w-8 bg-teal-600' : 'w-2.5 bg-teal-200'}`}
                  aria-label={`Testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
}
