import { supabase } from '../lib/supabase'

export async function getActiveCampaignDiscounts() {
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('merchant_campaigns').select('merchant_id, campaigns!inner(discount_percent, starts_at, ends_at, is_active)').eq('campaigns.is_active', true).lte('campaigns.starts_at', now).gte('campaigns.ends_at', now)
  if (error) return {}
  return (data || []).reduce((map, row) => {
    map[row.merchant_id] = Math.max(map[row.merchant_id] || 0, Number(row.campaigns.discount_percent))
    return map
  }, {})
}

// Phase 8 (TASK6.md): per-product campaign submissions take priority over
// the whole-store join discount above -- a submission is a specific
// merchant-set (and usually admin-approved) price, not just a flat
// store-wide percentage. Keyed by product_id so applyCampaignDiscount can
// look a product up directly instead of only knowing its merchant.
export async function getActiveCampaignProducts() {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('campaign_products')
    .select('product_id, campaign_price, campaigns!inner(name, ends_at, starts_at, is_active)')
    .eq('status', 'active').eq('campaigns.is_active', true).lte('campaigns.starts_at', now).gte('campaigns.ends_at', now)
  if (error) return {}
  return (data || []).reduce((map, row) => {
    const price = Number(row.campaign_price)
    if (!map[row.product_id] || price < map[row.product_id].price) {
      map[row.product_id] = { price, campaignName: row.campaigns.name, endsAt: row.campaigns.ends_at }
    }
    return map
  }, {})
}

export function applyCampaignDiscount(product, discounts, productCampaigns = {}) {
  const productCampaign = productCampaigns[product.id]
  if (productCampaign) {
    const price = Number(product.price) || 0
    const percent = price > 0 ? Number(((1 - productCampaign.price / price) * 100).toFixed(2)) : 0
    return { ...product, campaign_discount_percent: percent, campaign_price: productCampaign.price, campaign_name: productCampaign.campaignName, campaign_ends_at: productCampaign.endsAt }
  }
  return { ...product, campaign_discount_percent: discounts[product.merchant_id] || 0 }
}
