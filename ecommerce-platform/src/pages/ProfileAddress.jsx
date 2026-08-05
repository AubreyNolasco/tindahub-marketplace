import { useEffect, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cleanText } from '../utils/security'
import AddressFields from '../components/address/AddressFields'
import { COMPLETE_ADDRESS_HELP, composeAddress, emptyAddressParts, isCompleteAddress, partsFromLegacyAddress } from '../utils/address'
import { resolvePsgcCodes } from '../lib/services/psgc'

export default function ProfileAddress({ merchant = false }) {
  const { user, profile, refreshProfile } = useAuth()
  const [parts, setParts] = useState(emptyAddressParts())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const source = merchant ? profile?.merchant_profiles : profile
    if (!source) return
    const hasStructured = source.street || source.barangay || source.city || source.province || source.postal_code
    if (!hasStructured) { setParts(partsFromLegacyAddress(merchant ? source.business_address : source.address)); return }
    const loaded = { street: source.street || '', barangay: source.barangay || '', city: source.city || '', province: source.province || '', postalCode: source.postal_code || '', latitude: merchant ? source.pickup_latitude ?? null : source.latitude ?? null, longitude: merchant ? source.pickup_longitude ?? null : source.longitude ?? null, provinceCode: null, cityCode: null }
    setParts(loaded)
    // Saved rows only ever had names, not PSGC codes — resolve them so
    // the Province/City dropdowns show the existing selection instead of
    // appearing blank on reopen.
    resolvePsgcCodes(loaded.province, loaded.city).then(({ provinceCode, cityCode }) => {
      setParts((current) => (current.province === loaded.province && current.city === loaded.city ? { ...current, provinceCode, cityCode } : current))
    }).catch(() => {})
  }, [profile, merchant])

  const composed = composeAddress(parts)

  const save = async (event) => {
    event.preventDefault()
    if (!isCompleteAddress(composed)) return toast.error('Please enter a complete address.')
    setSaving(true)
    const table = merchant ? 'merchant_profiles' : 'profiles'
    const addressColumn = merchant ? 'business_address' : 'address'
    const payload = {
      [addressColumn]: cleanText(composed, 500),
      street: cleanText(parts.street, 200) || null,
      barangay: cleanText(parts.barangay, 120) || null,
      city: cleanText(parts.city, 120) || null,
      province: cleanText(parts.province, 120) || null,
      postal_code: cleanText(parts.postalCode, 10) || null,
      ...(merchant ? { pickup_latitude: parts.latitude, pickup_longitude: parts.longitude } : { latitude: parts.latitude, longitude: parts.longitude }),
    }
    const { error } = await supabase.from(table).update(payload).eq('id', user.id)
    setSaving(false)
    if (error) return toast.error(error.message)
    await refreshProfile()
    toast.success('Address details updated.')
  }

  return <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
    <div className="rounded-3xl border border-black/[0.06] bg-surface p-6 shadow-soft sm:p-8">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"><MapPin size={23} /></span>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">{merchant ? 'Merchant Pickup Address' : 'Reseller Address'}</h1>
      <p className="mt-2 text-sm leading-6 text-ink/50">A complete address is required before you can {merchant ? 'upload products or place an order' : 'place an order'}.</p>
      <form onSubmit={save} className="mt-6 space-y-3">
        <AddressFields value={parts} onChange={setParts} required withCoordinates />
        <p className="text-xs leading-5 text-ink/45">{COMPLETE_ADDRESS_HELP}</p>
        <div className={`rounded-xl px-4 py-3 text-sm ${isCompleteAddress(composed) ? 'bg-teal-50 text-teal-700' : 'bg-mango-100/60 text-ink/60'}`}>{isCompleteAddress(composed) ? 'Address appears complete.' : 'Address is incomplete.'}</div>
        <button disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : 'Save address'}</button>
      </form>
    </div>
  </div>
}
