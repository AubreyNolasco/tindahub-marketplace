import { useEffect, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cleanText } from '../utils/security'
import { COMPLETE_ADDRESS_HELP, isCompleteAddress } from '../utils/address'

export default function ProfileAddress({ merchant = false }) {
  const { user, profile, refreshProfile } = useAuth(); const [address, setAddress] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { setAddress(merchant ? profile?.merchant_profiles?.business_address || '' : profile?.address || '') }, [profile, merchant])
  const save = async (event) => { event.preventDefault(); if (!isCompleteAddress(address)) return toast.error('Please enter a complete address.'); setSaving(true); const table = merchant ? 'merchant_profiles' : 'profiles'; const column = merchant ? 'business_address' : 'address'; const { error } = await supabase.from(table).update({ [column]: cleanText(address, 500) }).eq('id', user.id); setSaving(false); if (error) return toast.error(error.message); await refreshProfile(); toast.success('Address details updated.') }
  return <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8"><div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-soft sm:p-8"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"><MapPin size={23} /></span><h1 className="mt-4 font-display text-2xl font-bold text-ink">{merchant ? 'Merchant Pickup Address' : 'Reseller Address'}</h1><p className="mt-2 text-sm leading-6 text-ink/50">A complete address is required before you can {merchant ? 'upload products or place an order' : 'place an order'}.</p><form onSubmit={save} className="mt-6"><label className="text-sm font-semibold text-ink/70">Complete address<textarea required rows="5" maxLength="500" className="input-field mt-2 resize-none" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Unit/House No., Street, Barangay, City, Province, Postal Code, Landmark" /></label><p className="mt-2 text-xs leading-5 text-ink/45">{COMPLETE_ADDRESS_HELP}</p><div className={`mt-4 rounded-xl px-4 py-3 text-sm ${isCompleteAddress(address) ? 'bg-teal-50 text-teal-700' : 'bg-mango-100/60 text-ink/60'}`}>{isCompleteAddress(address) ? 'Address appears complete.' : 'Address is incomplete.'}</div><button disabled={saving} className="btn-primary mt-5 flex w-full items-center justify-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : 'Save address'}</button></form></div></div>
}
