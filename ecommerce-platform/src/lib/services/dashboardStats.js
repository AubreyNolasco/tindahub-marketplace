import { supabase } from '../supabase'

// Thin wrappers around the admin dashboard leaderboard RPCs. All
// aggregation (SUM/COUNT/GROUP BY) happens in the database so the
// frontend only receives a single ranked row per endpoint.

export async function getTopProduct() {
  const { data, error } = await supabase.rpc('get_top_product')
  if (error) throw error
  return data?.[0] || null
}

export async function getTopReseller() {
  const { data, error } = await supabase.rpc('get_top_reseller')
  if (error) throw error
  return data?.[0] || null
}

export async function getTopMerchant() {
  const { data, error } = await supabase.rpc('get_top_merchant')
  if (error) throw error
  return data?.[0] || null
}
