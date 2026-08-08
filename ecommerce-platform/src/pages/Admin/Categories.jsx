import { useEffect, useMemo, useState } from 'react'
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
  const [parentId, setParentId] = useState('')
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

  // Top-level categories only, since a subcategory can't itself be a
  // parent (enforced server-side by enforce_category_tree_depth()).
  const topLevelCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories])
  const tree = useMemo(() => topLevelCategories.map((parent) => ({
    ...parent,
    children: categories.filter((c) => c.parent_id === parent.id),
  })), [categories, topLevelCategories])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('categories').insert({ name: name.trim(), slug: slugify(name), parent_id: parentId || null })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Category added successfully.')
    setName('')
    setParentId('')
    setShowForm(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this category? Products using it will become uncategorized.')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Category deleted successfully.')
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
        <form onSubmit={handleAdd} className="card p-5 mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <input
              required
              className="input-field"
              placeholder="Category name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" disabled={saving} className="btn-primary flex-shrink-0">Save</button>
          </div>
          <label className="block text-xs font-semibold text-ink/60">
            Parent category (optional)
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="input-field mt-1 text-sm">
              <option value="">None — top-level category</option>
              {topLevelCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </form>
      )}

      {categories.length === 0 ? (
        <EmptyState icon={Tag} title="No categories yet" message="Add the first category for the catalog." />
      ) : (
        <div className="space-y-2">
          {tree.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-ink/40">{c.slug}</p>
                </div>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-ink/40 hover:text-coral-500" aria-label={`Delete ${c.name}`}>
                  <Trash2 size={16} />
                </button>
              </div>
              {c.children.length > 0 && (
                <div className="mt-3 ml-4 space-y-2 border-l border-black/10 pl-4">
                  {c.children.map((child) => (
                    <div key={child.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-ink">{child.name}</p>
                        <p className="text-xs text-ink/40">{child.slug}</p>
                      </div>
                      <button onClick={() => handleDelete(child.id)} className="p-2 text-ink/40 hover:text-coral-500" aria-label={`Delete ${child.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
