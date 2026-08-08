import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, ShieldAlert, Store, UserRound, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SAMPLE_PRODUCTS } from '../../config/sampleProducts'

export default function TestAccounts() {
  const { refreshProfile } = useAuth()
  const [switching, setSwitching] = useState('')
  const [resetting, setResetting] = useState(false)
  const [seedingSamples, setSeedingSamples] = useState(false)
  const [deletingSamples, setDeletingSamples] = useState(false)
  const navigate = useNavigate()

  const switchTo = async (targetRole) => {
    setSwitching(targetRole)
    const { error } = await supabase.rpc('switch_role_for_demo', { p_target_role: targetRole })
    setSwitching('')
    if (error) return toast.error(error.message)
    await refreshProfile()
    toast.success(`Switched to ${targetRole} mode.`)
    navigate(targetRole === 'reseller' ? '/reseller' : '/merchant', { replace: true })
  }

  const resetDemoData = async () => {
    if (!window.confirm('Delete all orders, products, customers, and wallet history created while in demo mode? This cannot be undone.')) return
    setResetting(true)
    const { error } = await supabase.rpc('reset_admin_demo_data')
    setResetting(false)
    if (error) return toast.error(error.message)
    toast.success('Demo data cleared.')
  }

  // Adds/refreshes the standard sample catalog (photos, prices, a
  // sold-count anchor, and one rating each) under the Admin Demo
  // Merchant account, so anyone previewing the marketplace UI sees real
  // product cards instead of an empty catalog. Safe to click repeatedly
  // — existing sample products are updated in place, not duplicated.
  const seedSamples = async () => {
    setSeedingSamples(true)
    const { data, error } = await supabase.rpc('admin_seed_sample_catalog', { p_products: SAMPLE_PRODUCTS })
    setSeedingSamples(false)
    if (error) return toast.error(error.message)
    toast.success(`Samples ready: ${data.added} added, ${data.updated} refreshed, ${data.reviews_added} rating${data.reviews_added === 1 ? '' : 's'} seeded.`)
  }

  const deleteSamples = async () => {
    if (!window.confirm('Remove all sample products (and their seeded ratings/sold history)? This cannot be undone.')) return
    setDeletingSamples(true)
    const { data, error } = await supabase.rpc('admin_delete_sample_catalog')
    setDeletingSamples(false)
    if (error) return toast.error(error.message)
    toast.success(`Removed ${data.products_deleted} sample product${data.products_deleted === 1 ? '' : 's'}.`)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Test Accounts</h1>
        <p className="mt-1 text-sm text-ink/50">Legacy demo accounts have been removed.</p>
      </div>

      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mango-100 text-mango-700"><ShieldAlert size={26} /></span>
        <p className="font-bold text-ink">No test accounts configured</p>
        <p className="max-w-sm text-sm text-ink/50">
          merchant@gmail.com and reseller@gmail.com were deleted. Use the Admin demo mode below instead
          to fully test the Reseller and Merchant workspaces with your own account.
        </p>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-display font-bold text-ink">Admin demo mode</h2>
        <p className="mb-4 text-xs text-ink/50">
          Temporarily switches your own account's role so you can place real orders, manage real
          products, and use the wallet exactly like a real Reseller or Merchant. Your Admin access is
          suspended while switched — use "Back to Admin" (shown at the top of every page) to return.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => switchTo('reseller')}
            disabled={!!switching}
            className="card group flex items-center gap-3 p-5 text-left hover:border-mango-200 disabled:opacity-50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mango-100 text-mango-700">
              {switching === 'reseller' ? <Loader2 size={20} className="animate-spin" /> : <UserRound size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">Switch to Reseller Mode</p>
              <p className="text-xs text-ink/50">Full reseller workspace access</p>
            </div>
          </button>
          <button
            onClick={() => switchTo('merchant')}
            disabled={!!switching}
            className="card group flex items-center gap-3 p-5 text-left hover:border-teal-100 disabled:opacity-50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-700">
              {switching === 'merchant' ? <Loader2 size={20} className="animate-spin" /> : <Store size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">Switch to Merchant Mode</p>
              <p className="text-xs text-ink/50">Full merchant workspace access</p>
            </div>
          </button>
        </div>

        <button
          onClick={resetDemoData}
          disabled={resetting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm font-bold text-coral-600 transition hover:bg-coral-100 disabled:opacity-50"
        >
          {resetting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          Delete demo data (orders, products, customers, wallet history)
        </button>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display font-bold text-ink">Sample catalog</h2>
        <p className="mb-4 text-xs text-ink/50">
          Populates the Admin Demo Merchant's store with {SAMPLE_PRODUCTS.length} sample products (real
          photos, prices, a sold-count badge, and one rating each) so the marketplace catalog isn't
          empty when previewing UI changes. Safe to run again anytime — existing samples are refreshed
          in place, not duplicated.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={seedSamples}
            disabled={seedingSamples || deletingSamples}
            className="card group flex items-center gap-3 p-5 text-left hover:border-teal-100 disabled:opacity-50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-700">
              {seedingSamples ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">Add / Refresh Samples</p>
              <p className="text-xs text-ink/50">Loads {SAMPLE_PRODUCTS.length} sample products with photos</p>
            </div>
          </button>
          <button
            onClick={deleteSamples}
            disabled={seedingSamples || deletingSamples}
            className="card group flex items-center gap-3 p-5 text-left hover:border-coral-200 disabled:opacity-50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral-100 text-coral-600">
              {deletingSamples ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">Delete Samples</p>
              <p className="text-xs text-ink/50">Removes sample products and their ratings/sold history</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
