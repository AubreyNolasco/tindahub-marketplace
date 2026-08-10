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

const normalizePlace = (value = '') => value.toLocaleLowerCase()
  .replace(/\b(city of|province of|municipality of|city|municipality|province|brgy|barangay)\b/g, '')
  .replace(/[^a-z0-9]/g, '')

const findPlace = (rows, ...candidates) => {
  const names = candidates.filter(Boolean).map(normalizePlace)
  return rows.find((row) => names.includes(normalizePlace(row.name))) || null
}

let allCitiesPromise
const listAllCities = async () => {
  if (!allCitiesPromise) {
    allCitiesPromise = (async () => {
      const rows = []
      const pageSize = 1000
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase.from('psgc_cities').select('code, name, province_code').order('name').range(from, from + pageSize - 1)
        if (error) throw error
        rows.push(...(data || []))
        if (!data || data.length < pageSize) return rows
      }
    })()
      .catch((error) => {
        allCitiesPromise = null
        throw error
      })
  }
  return allCitiesPromise
}

export async function resolveGeocodedPsgc(parts = {}) {
  const provinces = await listProvinces()
  const provinceAliases = /metro manila|national capital region|\bncr\b/i.test(parts.province || '')
    ? ['Metro Manila', 'National Capital Region', parts.province]
    : [parts.province]
  let province = findPlace(provinces, ...provinceAliases)
  let city = null

  if (province) {
    city = findPlace(await listCities(province.code), parts.city)
  } else if (parts.city) {
    // Nominatim often returns only a broad region for Philippine places
    // (for example Central Visayas for Cebu City). Use an unambiguous
    // official city/municipality match to recover its real province.
    const cityMatches = (await listAllCities()).filter((row) => normalizePlace(row.name) === normalizePlace(parts.city))
    if (cityMatches.length === 1) {
      city = cityMatches[0]
      province = provinces.find((row) => row.code === city.province_code) || null
    }
  }

  if (!province) return {}
  if (!city) return { province: province.name, provinceCode: province.code }
  const barangays = await listBarangays(city.code)
  const barangay = findPlace(barangays, parts.barangay)
  return {
    province: province.name, provinceCode: province.code,
    city: city.name, cityCode: city.code,
    ...(barangay ? { barangay: barangay.name } : {}),
  }
}
