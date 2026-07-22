export const WITHDRAWAL_MINIMUM = 500
export const WITHDRAWAL_DAILY_LIMIT = 100000
export const PAYOUT_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const DELIVERY_CONFIRMATION_DAYS = 7

export function customerPaymentStatus(expected, received) {
  const due = Number(expected), paid = Number(received)
  if (!Number.isFinite(due) || !Number.isFinite(paid) || due < 0 || paid < 0) throw new Error('INVALID_AMOUNT')
  if (paid === 0) return 'unpaid'
  return paid < due ? 'partially_paid' : 'paid'
}

export function realizedResellerMargin(received, walletOrderCost) {
  return Math.round((Number(received) - Number(walletOrderCost)) * 100) / 100
}

export function validateWithdrawal(amount, requestedToday = 0, payoutChangedAt = null, now = Date.now()) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value < WITHDRAWAL_MINIMUM) return 'MINIMUM_WITHDRAWAL_500'
  if (value + Number(requestedToday) > WITHDRAWAL_DAILY_LIMIT) return 'DAILY_WITHDRAWAL_LIMIT_100000'
  if (payoutChangedAt && now - new Date(payoutChangedAt).getTime() < PAYOUT_CHANGE_COOLDOWN_MS) return 'ACCOUNT_CHANGE_COOLDOWN'
  return null
}

export function autoCompleteDate(estimatedDelivery, shippedAt) {
  const baseline = Math.max(new Date(estimatedDelivery || 0).getTime(), new Date(shippedAt).getTime())
  return new Date(baseline + DELIVERY_CONFIRMATION_DAYS * 86400000)
}
