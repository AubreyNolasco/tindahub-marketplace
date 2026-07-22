export const PROHIBITED_PRODUCT_RULES = [
  { title: 'Illegal drugs and controlled substances', detail: 'Narcotics, drug paraphernalia, or products promoted for illegal drug use.' },
  { title: 'Weapons and dangerous materials', detail: 'Firearms, ammunition, explosives, improvised weapons, and hazardous or toxic materials.' },
  { title: 'Counterfeit, stolen, or infringing goods', detail: 'Fake brands, unauthorized replicas, stolen items, pirated media, and products that misuse intellectual property.' },
  { title: 'Adult exploitation and obscene content', detail: 'Pornographic products, sexual exploitation, and any content involving or endangering minors.' },
  { title: 'Gambling and fraudulent items', detail: 'Illegal betting, fake IDs/documents, account-selling, scams, and tools intended for fraud or unauthorized access.' },
  { title: 'Personal or financial data', detail: 'Customer lists, login credentials, bank/e-wallet accounts, SIM identities, or other private personal information.' },
  { title: 'Unregistered or unauthorized regulated goods', detail: 'Medicines, supplements, cosmetics, medical devices, tobacco/vape, alcohol, pesticides, and certification-controlled goods without required permits or registration.' },
  { title: 'Unsafe, recalled, expired, or misrepresented goods', detail: 'Expired/recalled products, undisclosed defects, false health claims, misleading photos, or inaccurate condition/origin.' }
]

// Keep phrases specific to avoid blocking legitimate listings such as kitchen knives or toy products.
export const BLOCKED_PRODUCT_PATTERNS = [
  'illegal drugs', 'shabu', 'methamphetamine', 'cocaine', 'heroin', 'ecstasy pills',
  'drug paraphernalia', 'unlicensed firearm', 'ghost gun', 'live ammunition',
  'improvised explosive', 'pipe bomb', 'counterfeit', 'fake branded', 'class a replica',
  'stolen goods', 'pirated software', 'child pornography', 'sexual services',
  'online sabong', 'illegal gambling', 'fake id', 'fake passport', 'fake diploma',
  'bank account for sale', 'e-wallet account for sale', 'sim account for sale',
  'stolen account', 'login credentials', 'customer database for sale', 'credit card dump',
  'unregistered medicine', 'unregistered supplement', 'unregistered cosmetic',
  'unregistered medical device', 'no fda approval', 'expired product', 'recalled product'
]

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function findProductSafetyViolation(product) {
  const searchable = normalize([product.name, product.description, product.product_type, product.sku].join(' '))
  return BLOCKED_PRODUCT_PATTERNS.find((phrase) => searchable.includes(normalize(phrase))) || null
}
