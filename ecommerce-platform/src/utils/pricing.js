export function getUnitPrice(product, quantity) {
  const base = Number(product.price) || 0
  const campaignDiscount = Number(product.campaign_discount_percent) || 0
  if (campaignDiscount > 0) return Number((base * (1 - campaignDiscount / 100)).toFixed(2))
  const tiers = Array.isArray(product.discount_tiers) ? product.discount_tiers : []
  return tiers.reduce((price, tier) => quantity >= Number(tier.min_qty) ? Math.min(price, Number(tier.price) || price) : price, base)
}

export function getResellerUnitPrice(product, quantity) {
  const wholesale = Number(product.wholesale_price)
  const base = wholesale > 0 ? wholesale : getUnitPrice(product, quantity)
  const tiers = Array.isArray(product.discount_tiers) ? product.discount_tiers : []
  return tiers.reduce((price, tier) => quantity >= Number(tier.min_qty) ? Math.min(price, Number(tier.price) || price) : price, base)
}
