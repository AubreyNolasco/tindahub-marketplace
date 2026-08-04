import { supabase } from '../supabase'

// Thin wrappers around the admin dashboard leaderboard RPCs. All
// aggregation (SUM/COUNT/GROUP BY) happens in the database so the
// frontend only receives a single ranked row per endpoint.
//
// Each function accepts an optional date range (YYYY-MM-DD strings).
// When both are null, the ranking is all-time.

export async function getTopProduct(startDate = null, endDate = null) {
  const { data, error } = await supabase.rpc('get_top_product', {
    p_start_date: startDate,
    p_end_date: endDate
  })
  if (error) throw error
  return data?.[0] || null
}

export async function getTopReseller(startDate = null, endDate = null) {
  const { data, error } = await supabase.rpc('get_top_reseller', {
    p_start_date: startDate,
    p_end_date: endDate
  })
  if (error) throw error
  return data?.[0] || null
}

export async function getTopMerchant(startDate = null, endDate = null) {
  const { data, error } = await supabase.rpc('get_top_merchant', {
    p_start_date: startDate,
    p_end_date: endDate
  })
  if (error) throw error
  return data?.[0] || null
}
