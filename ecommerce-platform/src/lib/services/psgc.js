import { supabase } from '../supabase'

// Cascading Province -> City/Municipality -> Barangay, backed by the
// official PSGC reference tables (20260806000600_psgc_reference_data.sql)
// instead of free text, so a barangay can only ever be one that actually
// belongs to the selected city.

export async function listProvinces() {
  const { data, error } = await supabase.from('psgc_provinces').select('code, name').order('name')
  if (error) throw error
  return data || []
}

export async function listCities(provinceCode) {
  if (!provinceCode) return []
  const { data, error } = await supabase.from('psgc_cities').select('code, name').eq('province_code', provinceCode).order('name')
  if (error) throw error
  return data || []
}

export async function listBarangays(cityCode) {
  if (!cityCode) return []
  const { data, error } = await supabase.from('psgc_barangays').select('code, name').eq('city_code', cityCode).order('name')
  if (error) throw error
  return data || []
}

// Existing rows saved their province/city as plain names (typed free
// text, or composed from an earlier version of this form before the
// dropdowns existed). Re-opening the form needs to turn those names back
// into codes so the cascading dropdowns can show the current selection
// instead of appearing blank. Best-effort: if a name doesn't match
// anything (renamed, misspelled from the old free-text days), the
// dropdown just starts unselected and the user re-picks it once.
export async function resolvePsgcCodes(provinceName, cityName) {
  if (!provinceName) return { provinceCode: null, cityCode: null }
  const { data: province } = await supabase.from('psgc_provinces').select('code').ilike('name', provinceName).maybeSingle()
  if (!province) return { provinceCode: null, cityCode: null }
  if (!cityName) return { provinceCode: province.code, cityCode: null }
  const { data: city } = await supabase.from('psgc_cities').select('code').eq('province_code', province.code).ilike('name', cityName).maybeSingle()
  return { provinceCode: province.code, cityCode: city?.code || null }
}
