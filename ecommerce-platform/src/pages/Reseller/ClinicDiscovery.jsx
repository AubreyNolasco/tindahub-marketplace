import { useEffect, useState } from 'react'
import { Stethoscope, Building2, UserRound, Phone, MapPin, Clock, DollarSign, Send, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { cleanText } from '../../utils/security'

export default function ClinicDiscovery() {
  const { user } = useAuth()
  const [clinics, setClinics] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRefer, setShowRefer] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    const [clinicResult, customerResult] = await Promise.all([
      supabase.rpc('get_clinic_merchants_with_services'),
      supabase.from('customers').select('*').eq('reseller_id', user.id).order('name')
    ])
    if (clinicResult.error) toast.error(clinicResult.error.message)
    if (customerResult.error) toast.error(customerResult.error.message)
    setClinics(clinicResult.data || [])
    setCustomers(customerResult.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openRefer = (merchantId, service) => {
    setShowRefer({ merchantId, service })
    setSelectedCustomer('')
    setManualName('')
    setManualPhone('')
    setManualAddress('')
  }

  const handleRefer = async () => {
    if (!showRefer) return
    setSending(true)
    const customer = customers.find((c) => c.id === selectedCustomer)
    const name = cleanText(customer?.name || manualName, 200)
    const phone = cleanText(customer?.phone || manualPhone, 50)
    const address = cleanText(customer?.address || manualAddress, 500)
    if (!name) { toast.error('Customer name is required.'); setSending(false); return }
    const { error } = await supabase.rpc('create_referral_appointment', {
      p_merchant_id: showRefer.merchantId,
      p_service_id: showRefer.service.id,
      p_customer_name: name,
      p_customer_phone: phone,
      p_customer_address: address
    })
    if (error) { toast.error(error.message); setSending(false); return }
    toast.success('Referred ' + name + ' to ' + showRefer.service.name + '. The provider will follow up.')
    setShowRefer(null)
    setSending(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Referral opportunities</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">Services & Providers</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">
          Refer your customers to partner clinics, real estate agents, and service providers. Earn a referral fee when the service is completed — no upfront cost.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner /></div>
      ) : clinics.length === 0 ? (
        <EmptyState icon={Stethoscope} title="No providers available" message="Partner clinics and service providers will appear here once merchants set up their services." />
      ) : (
        <div className="space-y-8">
          {clinics.map((clinic) => {
            const services = clinic.services || []
            if (services.length === 0) return null
            return (
              <section key={clinic.merchant_id} className="card overflow-hidden">
                <div className="bg-gradient-to-r from-teal-900 to-teal-700 px-6 py-5 text-white">
                  <div className="flex items-center gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15">
                      {clinic.avatar_url ? <img src={clinic.avatar_url} alt="" className="h-full w-full rounded-full object-cover" /> : <Building2 size={24} />}
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold">{clinic.business_name}</h2>
                      {clinic.business_address && <p className="mt-1 text-sm text-white/60">{clinic.business_address}</p>}
                    </div>
                  </div>
                  {clinic.business_description && <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{clinic.business_description}</p>}
                </div>
                <div className="divide-y divide-black/[0.04]">
                  {services.map((service) => (
                    <div key={service.id} className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-ink">{service.name}</h3>
                        {service.description && <p className="mt-0.5 text-sm text-ink/50">{service.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                          <span className="flex items-center gap-1.5 text-teal-700 font-bold"><DollarSign size={14} /> {peso(service.service_fee)}</span>
                          <span className="flex items-center gap-1.5 text-mango-600 font-semibold"><Send size={14} /> Your fee: {peso(service.referral_fee)}</span>
                          {service.estimated_duration_minutes > 0 && <span className="flex items-center gap-1.5 text-ink/40 text-xs"><Clock size={13} /> ~{service.estimated_duration_minutes} min</span>}
                        </div>
                      </div>
                      <button onClick={() => openRefer(clinic.merchant_id, service)} className="btn-primary shrink-0 flex items-center gap-1.5 text-sm">
                        <UserRound size={15} /> Refer Customer
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Referral Modal */}
      {showRefer && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/65 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between bg-gradient-to-br from-teal-950 to-teal-700 px-6 py-5 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-mango-300">Refer customer</p>
                <h2 className="mt-1 font-display text-lg font-bold">{showRefer.service.name}</h2>
                <p className="mt-1 text-sm text-white/60">Service fee: {peso(showRefer.service.service_fee)}</p>
              </div>
              <button onClick={() => setShowRefer(null)} className="rounded-xl bg-white/10 p-2"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {customers.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-ink/70">Select a saved customer</label>
                  <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="input-field mt-1">
                    <option value="">-- Choose customer --</option>
                    {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} {c.phone ? ('· ' + c.phone) : ''}</option>))}
                  </select>
                </div>
              )}
              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 border-t border-black/10" />
                <span className="relative mx-auto flex w-fit px-3 text-xs font-semibold text-ink/40 bg-white">{customers.length > 0 ? 'Or enter manually' : 'Enter customer details'}</span>
              </div>
              <div>
                <label className="text-sm font-semibold text-ink/70">Customer Name *</label>
                <input required maxLength={200} className="input-field mt-1" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Juan Dela Cruz" disabled={!!selectedCustomer} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold text-ink/70">Phone</label><input maxLength={50} className="input-field mt-1" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} placeholder="+63 912 345 6789" disabled={!!selectedCustomer} /></div>
                <div><label className="text-sm font-semibold text-ink/70">Address</label><input maxLength={500} className="input-field mt-1" value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} placeholder="City / Province" disabled={!!selectedCustomer} /></div>
              </div>
              <div className="rounded-xl bg-mango-100/60 p-4 text-xs leading-5 text-ink/55">
                <p className="font-semibold text-mango-700">How it works:</p>
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>The provider will contact the customer to arrange the service.</li>
                  <li>After the service is completed, the provider confirms it.</li>
                  <li><strong>{peso(showRefer.service.referral_fee)}</strong> is automatically transferred to your wallet.</li>
                </ol>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleRefer} disabled={sending || (!selectedCustomer && !manualName.trim())} className="btn-primary flex flex-1 items-center justify-center gap-2">
                  {sending && <Loader2 size={16} className="animate-spin" />}{sending ? 'Sending...' : ('Refer & Earn ' + peso(showRefer.service.referral_fee))}
                </button>
                <button onClick={() => setShowRefer(null)} className="btn-secondary px-4">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

