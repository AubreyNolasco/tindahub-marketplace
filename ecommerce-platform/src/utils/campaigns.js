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

export function applyCampaignDiscount(product, discounts) {
  return { ...product, campaign_discount_percent: discounts[product.merchant_id] || 0 }
}
