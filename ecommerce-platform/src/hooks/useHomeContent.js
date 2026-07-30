import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { applyCurrentBrand } from '../utils/brand'
import { fallback } from '../config/homeContent'

export default function useHomeContent() {
  const [content, setContent] = useState(fallback)

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'home').maybeSingle().then(({ data }) => {
      if (data?.value) {
        const value = applyCurrentBrand(data.value)
        setContent({ ...fallback, ...value, announcement: { ...fallback.announcement, ...value.announcement }, sections: { ...fallback.sections, ...value.sections }, banners: value.banners || [] })
      }
    })
  }, [])

  return content
}
