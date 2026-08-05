export function isCompleteAddress(address = '') {
  if (typeof address !== 'string') return false
  const value = address.trim()
  return value.length >= 25 && /\d/.test(value) && value.split(',').map((part) => part.trim()).filter(Boolean).length >= 4
}

export const COMPLETE_ADDRESS_HELP = 'Include house/building/unit number, street, barangay, city, province, and postal code when available. Separate address parts with commas.'

export function emptyAddressParts() {
  return { street: '', barangay: '', city: '', province: '', postalCode: '', latitude: null, longitude: null }
}

// Legacy single-text columns (profiles.address, customers.address,
// orders.shipping_address, ...) keep working unchanged — this composes
// the structured parts into the same comma-separated shape
// isCompleteAddress() already expects, so nothing downstream needs to
// know the fill-up form is now split.
export function composeAddress(parts = {}) {
  return [parts.street, parts.barangay, parts.city, parts.province, parts.postalCode]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ')
}

// Existing rows only ever stored one free-text string — there is no
// reliable way to re-split "123 Rizal St, Brgy San Jose, Cebu City,
// Cebu, 6000" back into named parts after the fact. Rather than guess
// (and risk silently mangling a real address), an existing legacy value
// is carried into the `street` field as a starting point so it's never
// lost, and the rest is left for the user to fill in properly once.
export function partsFromLegacyAddress(legacyAddress = '') {
  const parts = emptyAddressParts()
  if (legacyAddress && legacyAddress.trim()) parts.street = legacyAddress.trim()
  return parts
}
