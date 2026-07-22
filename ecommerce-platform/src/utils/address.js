export function isCompleteAddress(address = '') {
  if (typeof address !== 'string') return false
  const value = address.trim()
  return value.length >= 25 && /\d/.test(value) && value.split(',').map((part) => part.trim()).filter(Boolean).length >= 4
}

export const COMPLETE_ADDRESS_HELP = 'Include house/building/unit number, street, barangay, city, province, and postal code when available. Separate address parts with commas.'
