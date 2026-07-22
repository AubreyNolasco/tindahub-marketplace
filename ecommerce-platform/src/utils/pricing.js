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

export function getSuggestedCustomerPrice(product) {
  return Number(product.suggested_retail_price) || Number(product.price) || 0
}

export function getResellerOperationFee(buyingSubtotal) {
  const subtotal = Math.max(0, Number(buyingSubtotal) || 0)
  if (!subtotal) return 0
  return Math.max(3, Math.min(50, Number((subtotal * 0.01).toFixed(2))))
}

export function getResellerProfitEstimate(product, quantity = 1, customerUnitPrice = getSuggestedCustomerPrice(product)) {
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1))
  const buyingUnitPrice = getResellerUnitPrice(product, safeQuantity)
  const sellingUnitPrice = Math.max(0, Number(customerUnitPrice) || 0)
  const buyingSubtotal = Number((buyingUnitPrice * safeQuantity).toFixed(2))
  const customerTotal = Number((sellingUnitPrice * safeQuantity).toFixed(2))
  const systemFee = getResellerOperationFee(buyingSubtotal)
  const grossProfit = Number((customerTotal - buyingSubtotal).toFixed(2))
  const estimatedProfit = Number((grossProfit - systemFee).toFixed(2))
  return { quantity: safeQuantity, buyingUnitPrice, sellingUnitPrice, buyingSubtotal, customerTotal, systemFee, grossProfit, estimatedProfit }
}
