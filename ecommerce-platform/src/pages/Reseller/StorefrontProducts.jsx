import { useEffect, useState } from 'react'
import { Copy, ImagePlus, Loader2, Package, Plus, Store, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cleanText, safeUploadPath, validateImage } from '../../utils/security'
import { peso } from '../../utils/format'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'

export default function StorefrontProducts() {
  const { user, profile, refreshProfile } = useAuth()
  const [products, setProducts] = useState([])
  const [bio, setBio] = useState('')
  const [storeName, setStoreName] = useState('')
  const [contacts,setContacts]=useState({facebook:'',phone:'',viber:'',whatsapp:''})
  const [avatar, setAvatar] = useState(null)
  const [cover, setCover] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const {data,error}=await supabase.from('reseller_storefront_products').select('product_id,products(id,name,price,wholesale_price,images,stock_quantity,is_active,merchant_profiles(business_name))').eq('reseller_id',user.id).order('created_at',{ascending:false})
    if(error)toast.error(error.message)
    setProducts((data||[]).map(row=>row.products).filter(product=>product?.is_active))
    setBio(profile?.reseller_bio || '')
    setStoreName(profile?.storefront_name || `${profile?.full_name || 'My'} Store`)
    setContacts({facebook:profile?.storefront_facebook_url||'',phone:profile?.storefront_contact_number||'',viber:profile?.storefront_viber_number||'',whatsapp:profile?.storefront_whatsapp_number||''})
    setLoading(false)
  }

  useEffect(()=>{ if(user) load() },[user?.id])

  const remove = async productId => {
    const {error}=await supabase.from('reseller_storefront_products').delete().eq('reseller_id',user.id).eq('product_id',productId)
    if(error)return toast.error(error.message)
    setProducts(current=>current.filter(product=>product.id!==productId))
    toast.success('Product removed from your customer page.')
  }

  const upload = async (file,prefix) => {
    const validation=validateImage(file)
    if(validation) throw new Error(validation)
    const path=safeUploadPath(user.id,prefix,file)
    const {error}=await supabase.storage.from('reseller-storefronts').upload(path,file,{contentType:file.type,upsert:false})
    if(error) throw error
    return supabase.storage.from('reseller-storefronts').getPublicUrl(path).data.publicUrl
  }

  const saveProfile = async event => {
    event.preventDefault();setSaving(true)
    try{
      const avatarUrl=avatar?await upload(avatar,'profile'):profile?.avatar_url||null
      const coverUrl=cover?await upload(cover,'cover'):profile?.cover_url||null
      const cleanStoreName=cleanText(storeName,100)
      if(cleanStoreName.length<2)throw new Error('Store name must contain at least 2 characters.')
      const facebook=cleanText(contacts.facebook,300)
      if(facebook&&!/^https:\/\/(www\.)?(facebook\.com|fb\.com|m\.me)\//i.test(facebook))throw new Error('Enter a valid HTTPS Facebook or Messenger link.')
      const payload={storefront_name:cleanStoreName,avatar_url:avatarUrl,cover_url:coverUrl,reseller_bio:cleanText(bio,500),storefront_facebook_url:facebook||null,storefront_contact_number:cleanText(contacts.phone,30)||null,storefront_viber_number:cleanText(contacts.viber,30)||null,storefront_whatsapp_number:cleanText(contacts.whatsapp,30)||null}
      const {error}=await supabase.from('profiles').update(payload).eq('id',user.id)
      if(error)throw error
      await refreshProfile();setAvatar(null);setCover(null);toast.success('Customer storefront updated.')
    }catch(error){toast.error(error.message)}finally{setSaving(false)}
  }

  const storefrontPath = profile?.storefront_slug
    ? `/store/${profile.storefront_slug}`
    : `/reseller-store/${user.id}`
  const shareUrl = `${window.location.origin}${storefrontPath}`
  const copy=async()=>{await navigator.clipboard.writeText(shareUrl);toast.success('Customer page link copied.')}
  if(loading)return <div className="py-24"><Spinner/></div>
  return <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-teal-600">Customer storefront</p><h1 className="mt-1 font-display text-2xl font-bold">My Product List</h1><p className="mt-1 text-sm text-ink/50">Only products you get from the Merchant Catalog appear here and on your customer page.</p></div><div className="flex flex-wrap gap-2"><Link to="/catalog" className="btn-accent flex items-center gap-2 text-sm"><Plus size={15}/> Get Merchant products</Link><Link to={storefrontPath} className="btn-secondary text-sm">Preview page</Link><button onClick={copy} className="btn-primary flex items-center gap-2 text-sm"><Copy size={15}/> Copy link</button></div></div>
    <form onSubmit={saveProfile} className="card mt-6 overflow-hidden">
      <div className="relative h-36 bg-gradient-to-br from-teal-950 to-teal-600 sm:h-52">{profile?.cover_url&&<img src={profile.cover_url} alt="" className="h-full w-full object-cover"/>}<label className="absolute right-3 top-3 flex cursor-pointer items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-teal-800 shadow"><ImagePlus size={15}/> Cover photo<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>setCover(e.target.files?.[0]||null)}/></label></div>
      <div className="p-5 sm:p-6"><div className="-mt-16 flex items-end gap-4"><div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-teal-50 shadow-lg">{profile?.avatar_url?<img src={profile.avatar_url} alt="" className="h-full w-full object-cover"/>:<Store className="text-teal-500"/>}<label className="absolute inset-x-0 bottom-0 flex cursor-pointer justify-center bg-black/55 py-1.5 text-white"><Upload size={14}/><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>setAvatar(e.target.files?.[0]||null)}/></label></div><div className="pb-1"><h2 className="font-display text-xl font-bold">{storeName||profile?.full_name}</h2><p className="text-xs text-ink/45">{products.length} listed product{products.length===1?'':'s'}</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-ink/70">Store name<input required minLength="2" maxLength="100" value={storeName} onChange={e=>setStoreName(e.target.value)} className="input-field mt-2" placeholder="Juan Mini Mart"/><span className="mt-1 block text-[11px] font-normal text-ink/40">Link: /store/{profile?.storefront_slug||'your-store-name'}</span></label><label className="text-sm font-semibold text-ink/70">Storefront introduction<textarea maxLength="500" rows="3" value={bio} onChange={e=>setBio(e.target.value)} className="input-field mt-2 resize-none" placeholder="Tell customers what you sell and how you can help."/></label></div><section className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/60 p-4"><h3 className="font-display font-bold text-teal-900">Customer contact options</h3><p className="mt-1 text-xs leading-5 text-ink/50">Optional. Only completed fields appear in the How to Buy popup.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-ink/60">Facebook / Messenger link<input type="url" maxLength="300" value={contacts.facebook} onChange={e=>setContacts({...contacts,facebook:e.target.value})} className="input-field mt-1" placeholder="https://facebook.com/your-page"/></label><label className="text-xs font-semibold text-ink/60">Contact number<input type="tel" maxLength="30" value={contacts.phone} onChange={e=>setContacts({...contacts,phone:e.target.value})} className="input-field mt-1" placeholder="+63 917 123 4567"/></label><label className="text-xs font-semibold text-ink/60">Viber number<input type="tel" maxLength="30" value={contacts.viber} onChange={e=>setContacts({...contacts,viber:e.target.value})} className="input-field mt-1" placeholder="+63 917 123 4567"/></label><label className="text-xs font-semibold text-ink/60">WhatsApp number<input type="tel" maxLength="30" value={contacts.whatsapp} onChange={e=>setContacts({...contacts,whatsapp:e.target.value})} className="input-field mt-1" placeholder="+63 917 123 4567"/></label></div></section><p className="mt-2 text-xs text-ink/40">{avatar?.name||cover?.name?'New images selected. Save to publish them.':'JPG, PNG, or WebP · maximum 5 MB each'}</p><button disabled={saving} className="btn-primary mt-4 flex items-center gap-2">{saving&&<Loader2 size={15} className="animate-spin"/>}Save storefront profile</button></div>
    </form>
    <div className="mt-8"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-bold">Products I got from Merchants</h2><span className="badge bg-teal-50 text-teal-700">{products.length} listed</span></div>{products.length===0?<EmptyState icon={Package} title="No products in your list yet" message="Browse the Merchant Catalog and get a product before it appears here." action={<Link to="/catalog" className="btn-primary">Browse Merchant products</Link>}/>:<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{products.map(product=><article key={product.id} className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-card"><div className="relative aspect-square bg-teal-50">{product.images?.[0]?<img src={product.images[0]} alt={product.name} className="h-full w-full object-cover"/>:<Package className="absolute inset-0 m-auto text-teal-300"/>}</div><div className="p-3"><p className="truncate text-xs font-bold text-teal-700">{product.merchant_profiles?.business_name}</p><h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold">{product.name}</h3><p className="mt-2 font-display font-bold text-teal-700">{peso(product.price)}</p><button onClick={()=>remove(product.id)} className="mt-3 w-full rounded-xl bg-coral-100 px-3 py-2 text-xs font-bold text-coral-700">Remove from my list</button></div></article>)}</div>}</div>
  </div>
}
