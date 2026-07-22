import { useEffect, useState } from 'react'
import { Tag, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (error) toast.error(error.message)
    setCategories(data || [])
    setLoading(false)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('categories').insert({ name: name.trim(), slug: slugify(name) })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Naidagdag ang category.')
    setName('')
    setShowForm(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Sigurado ka bang gusto mo tanggalin ang category na ito? Mawawalan ng category ang mga produktong gumagamit nito.')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Natanggal ang category.')
    load()
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-ink">Categories</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-sm flex items-center gap-1.5">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Category'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-5 mb-6 flex items-center gap-3">
          <input
            required
            className="input-field"
            placeholder="Pangalan ng category"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" disabled={saving} className="btn-primary flex-shrink-0">Save</button>
        </form>
      )}

      {categories.length === 0 ? (
        <EmptyState icon={Tag} title="No categories yet" message="Add the first category for the catalog." />
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-xs text-ink/40">{c.slug}</p>
              </div>
              <button onClick={() => handleDelete(c.id)} className="p-2 text-ink/40 hover:text-coral-500">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
