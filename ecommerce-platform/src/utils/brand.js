export const applyCurrentBrand = (value) => {
  if (typeof value === 'string') return value.replaceAll('RM HUB', 'JOM HUB').replaceAll('RM Hub', 'JOM HUB')
  if (Array.isArray(value)) return value.map(applyCurrentBrand)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, applyCurrentBrand(item)]))
  return value
}
