import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Image, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

// Same site_settings key/value pattern Admin/HomepageEditor.jsx already
// uses for the Landing page — just a different key ("marketplace"
// instead of "home") and a simpler shape, since the Marketplace
// slideshow only ever needs the slide list, not a whole hero/
// announcement-bar section that doesn't apply there. The always-first
// "campaign" slide (live discount %, countdown) is computed from real
// order/campaign data in Catalog.jsx itself and isn't editable here —
// only these custom slides that render after it.
const emptySlide = () => ({ id: crypto.randomUUID(), title: 'New promotional slide', text: 'Add your campaign message here.', button_label: 'Shop Now', button_link: '/marketplace', image_url: '', background: '#0B4D30', text_color: '#FFFFFF', visible: true })

export default function MarketplaceEditor() {
  const [slides, setSlides] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'marketplace').maybeSingle().then(({ data }) => {
      const loaded = data?.value?.slides || []
      setSlides(loaded)
      setSelected(loaded[0]?.id || null)
      setLoading(false)
    })
  }, [])

  const updateSlide = (id, key, value) => setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, [key]: value } : slide))
  const moveSlide = (index, direction) => setSlides((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current;[next[index], next[target]] = [next[target], next[index]]; return next })
  const addSlide = () => { const slide = emptySlide(); setSlides((current) => [...current, slide]); setSelected(slide.id) }
  const removeSlide = (id) => { setSlides((current) => current.filter((slide) => slide.id !== id)); setSelected(null) }
  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('site_settings').upsert({ key: 'marketplace', value: { slides } }, { onConflict: 'key' })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Marketplace slideshow published.')
  }
  const activeSlide = slides.find((slide) => slide.id === selected)

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-teal-600" size={28} /></div>

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Marketplace slideshow</h1>
          <p className="mt-1 text-sm text-ink/50">Custom promotional slides shown on the Marketplace page, after the live discount slide.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Publishing...' : 'Publish'}</button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {slides.map((slide, index) => (
            <div key={slide.id} className={`flex items-center rounded-xl border ${selected === slide.id ? 'border-teal-300 bg-teal-50' : 'border-black/[0.06] hover:bg-black/[0.02]'}`}>
              <button onClick={() => setSelected(slide.id)} className="min-w-0 flex-1 px-3 py-3 text-left">
                <p className="truncate text-sm font-semibold text-ink/80">{slide.title}</p>
                <p className="text-[11px] text-ink/40">{slide.visible === false ? 'Hidden' : 'Visible'}</p>
              </button>
              <div className="mr-1.5 flex">
                <button onClick={() => moveSlide(index, -1)} disabled={!index} title="Move up" aria-label="Move slide up" className="p-1 text-ink/35 disabled:opacity-20"><ArrowUp size={13} /></button>
                <button onClick={() => moveSlide(index, 1)} disabled={index === slides.length - 1} title="Move down" aria-label="Move slide down" className="p-1 text-ink/35 disabled:opacity-20"><ArrowDown size={13} /></button>
              </div>
            </div>
          ))}
          <button onClick={addSlide} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-200 px-3 py-3 text-xs font-bold text-teal-700 hover:bg-teal-50"><Plus size={15} /> Add slide</button>
        </aside>

        <section className="rounded-2xl border border-black/[0.06] bg-surface p-5">
          {!activeSlide ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center text-ink/40">
              <Image size={28} className="mb-2" />
              <p className="text-sm">Add a slide, or select one on the left, to edit it.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-ink">Edit slide</h2>
                <button onClick={() => removeSlide(activeSlide.id)} className="rounded-lg bg-coral-100 p-2 text-coral-600" aria-label="Delete slide"><Trash2 size={16} /></button>
              </div>
              <label className="flex items-center justify-between text-sm font-semibold text-ink/65">Visible <input type="checkbox" checked={activeSlide.visible !== false} onChange={(e) => updateSlide(activeSlide.id, 'visible', e.target.checked)} /></label>
              <label className="block text-xs font-semibold text-ink/65">Title<input className="input-field mt-1" value={activeSlide.title} onChange={(e) => updateSlide(activeSlide.id, 'title', e.target.value)} maxLength={120} /></label>
              <label className="block text-xs font-semibold text-ink/65">Description<textarea rows={3} className="input-field mt-1" value={activeSlide.text} onChange={(e) => updateSlide(activeSlide.id, 'text', e.target.value)} maxLength={400} /></label>
              <label className="block text-xs font-semibold text-ink/65">Image URL (optional)<input className="input-field mt-1" value={activeSlide.image_url} onChange={(e) => updateSlide(activeSlide.id, 'image_url', e.target.value)} placeholder="https://..." /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-ink/65">Button label<input className="input-field mt-1" value={activeSlide.button_label} onChange={(e) => updateSlide(activeSlide.id, 'button_label', e.target.value)} /></label>
                <label className="block text-xs font-semibold text-ink/65">Button link<input className="input-field mt-1" value={activeSlide.button_link} onChange={(e) => updateSlide(activeSlide.id, 'button_link', e.target.value)} /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-ink/65">Background<input type="color" className="mt-1 h-11 w-full rounded-lg" value={activeSlide.background} onChange={(e) => updateSlide(activeSlide.id, 'background', e.target.value)} /></label>
                <label className="block text-xs font-semibold text-ink/65">Text color<input type="color" className="mt-1 h-11 w-full rounded-lg" value={activeSlide.text_color} onChange={(e) => updateSlide(activeSlide.id, 'text_color', e.target.value)} /></label>
              </div>
              <div className="rounded-xl p-6" style={{ background: activeSlide.background, color: activeSlide.text_color }}>
                <p className="font-display text-xl font-bold">{activeSlide.title}</p>
                <p className="mt-1 text-sm opacity-80">{activeSlide.text}</p>
                {activeSlide.image_url && <img src={activeSlide.image_url} alt="" className="mt-3 h-32 w-full rounded-lg object-cover" />}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
