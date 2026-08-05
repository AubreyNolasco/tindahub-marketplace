import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, X, RefreshCw, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import DataTable from '../../components/ui/DataTable'
import ActionPopup, { DetailRow, DetailSection } from '../../components/ui/ActionPopup'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { cleanText } from '../../utils/security'
import { COMPLETE_ADDRESS_HELP, composeAddress, emptyAddressParts, isCompleteAddress } from '../../utils/address'
import AddressFields from '../../components/address/AddressFields'

export default function Customers() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', notes: '' })
  const [addressParts, setAddressParts] = useState(emptyAddressParts())
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('customers').select('*').eq('reseller_id', user.id).order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setCustomers(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e) => {
    e.preventDefault()
    const composedAddress = composeAddress(addressParts)
    if (!isCompleteAddress(composedAddress)) return toast.error('Please enter the customer’s complete address.')
    const payload = {
      reseller_id: user.id,
      name: cleanText(form.name, 160),
      phone: cleanText(form.phone, 30),
      notes: cleanText(form.notes, 1000),
      address: cleanText(composedAddress, 500),
      street: cleanText(addressParts.street, 200) || null,
      barangay: cleanText(addressParts.barangay, 120) || null,
      city: cleanText(addressParts.city, 120) || null,
      province: cleanText(addressParts.province, 120) || null,
      postal_code: cleanText(addressParts.postalCode, 10) || null,
      latitude: addressParts.latitude,
      longitude: addressParts.longitude,
    }
    const { error } = await supabase.from('customers').insert(payload)
    if (error) return toast.error(error.message)
    toast.success('Customer added.')
    setForm({ name: '', phone: '', notes: '' })
    setAddressParts(emptyAddressParts())
    setShowForm(false)
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('customers').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    toast.success('Customer removed.')
    load()
  }

  const columns = [
    { header: 'Name', accessor: 'name', sortable: true },
    { header: 'Phone', accessor: 'phone', sortable: true },
    { header: 'Address', accessor: 'address', sortable: true },
    { header: 'Date Added', accessor: 'created_at', format: 'date', sortable: true }
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Customer List</h1>
          <p className="mt-1 text-sm text-ink/50">Manage customers you serve and refer to clinics.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm flex items-center gap-1.5">
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'Add Customer'}
          </button>
          <button onClick={load} className="btn-secondary p-2.5">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-5 mb-6 space-y-3">
          <input required className="input-field" placeholder="Customer name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input-field" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div>
            <label className="text-sm font-semibold text-ink/70">Complete Delivery Address</label>
            <div className="mt-1"><AddressFields value={addressParts} onChange={setAddressParts} required withCoordinates /></div>
            <p className="mt-1 text-[11px] leading-4 text-ink/45">{COMPLETE_ADDRESS_HELP}</p>
          </div>
          <textarea className="input-field" placeholder="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" disabled={!isCompleteAddress(composeAddress(addressParts))} className="btn-primary w-full">Save Customer</button>
        </form>
      )}

      <DataTable
        columns={columns}
        data={customers}
        loading={loading}
        searchPlaceholder="Search by name, phone, address..."
        emptyTitle="No customers yet"
        emptyMessage="Add your regular customers for faster checkout and clinic referrals."
        onView={(row) => { setSelectedCustomer(row); setShowDetail(true) }}
        onDelete={(row) => setDeleteTarget(row)}
      />

      <ActionPopup open={showDetail} onClose={() => { setShowDetail(false); setSelectedCustomer(null) }} title={selectedCustomer?.name || 'Customer'} size="md">
        {selectedCustomer && (
          <>
            <DetailSection title="Contact Info">
              <DetailRow label="Name" value={selectedCustomer.name} />
              <DetailRow label="Phone" value={selectedCustomer.phone || '—'} />
              <DetailRow label="Address" value={selectedCustomer.address} />
              {selectedCustomer.notes && <DetailRow label="Notes" value={selectedCustomer.notes} />}
            </DetailSection>
            <div className="mt-6 flex gap-2">
              <Link
                to="/clinics"
                className="btn-accent flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-xl"
              >
                <Send size={15} /> Refer to Clinic
              </Link>
              <button onClick={() => { setShowDetail(false); setDeleteTarget(selectedCustomer) }} className="flex items-center gap-1.5 rounded-xl bg-coral-100 px-4 py-2.5 text-sm font-semibold text-coral-700">
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </>
        )}
      </ActionPopup>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete customer?"
        message={`Remove ${deleteTarget?.name || 'this customer'} from your list? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
