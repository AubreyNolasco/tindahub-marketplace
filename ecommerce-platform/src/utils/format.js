export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function firstDayOfMonth() {
  return `${today().slice(0, 8)}01`
}

export function peso(amount) {
  const n = Number(amount || 0)
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export const ORDER_STATUS_STYLES = {
  pending_payment: 'bg-mango-100 text-mango-600',
  payment_review: 'bg-teal-100 text-teal-700',
  confirmed: 'bg-teal-100 text-teal-700',
  processing: 'bg-teal-100 text-teal-700',
  shipped: 'bg-teal-100 text-teal-700',
  completed: 'bg-teal-500/15 text-teal-700',
  cancelled: 'bg-coral-100 text-coral-600'
}

export const ORDER_STATUS_LABELS = {
  pending_payment: 'Awaiting Payment',
  payment_review: 'Sinusuri ang Payment',
  confirmed: 'Confirmed',
  processing: 'Inihahanda',
  shipped: 'Nai-ship na',
  completed: 'Tapos na',
  cancelled: 'Kinansela'
}

export const TOPUP_STATUS_STYLES = {
  pending: 'bg-mango-100 text-mango-600',
  approved: 'bg-teal-100 text-teal-700',
  rejected: 'bg-coral-100 text-coral-600'
}

export const TOPUP_STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
}
