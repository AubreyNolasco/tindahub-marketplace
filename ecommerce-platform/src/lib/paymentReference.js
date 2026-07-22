import { supabase } from './supabase'
import { normalizePaymentReference } from '../utils/security'

export async function ensurePaymentReferenceAvailable(reference) {
  const { data, error } = await supabase.rpc('is_payment_reference_available', { p_reference: normalizePaymentReference(reference) })
  if (error) throw error
  if (!data) throw new Error('DUPLICATE_PAYMENT_REFERENCE')
}

export function paymentReferenceErrorMessage(error) {
  return /DUPLICATE_PAYMENT_REFERENCE|duplicate key|already.*reference/i.test(error?.message || '')
    ? 'This payment reference number was already used. Check the transaction and enter a new unique reference.'
    : error?.message || 'Unable to validate the payment reference.'
}
