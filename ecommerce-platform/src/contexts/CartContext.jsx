import { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { getSuggestedCustomerPrice, getUnitPrice, getResellerUnitPrice } from '../utils/pricing'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)
const STORAGE_PREFIX = 'rmhub_cart_v2'

const removeStoredCart = (key) => {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Some browsers block storage in private/restricted contexts.
  }
}

const readCart = (key) => {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      removeStoredCart(key)
      return []
    }
    return parsed
      .filter((item) => item && typeof item === 'object' && item.product_id)
      .map((item) => ({ ...item, cart_key: item.cart_key || `${item.product_id}:${item.customer_id || 'self'}` }))
  } catch {
    removeStoredCart(key)
    return []
  }
}

export function CartProvider({ children }) {
  const { user, role } = useAuth()
  const storageKey = `${STORAGE_PREFIX}:${user?.id || 'guest'}`
  const [cart, setCart] = useState(() => ({ key: storageKey, items: readCart(storageKey) }))
  const items = useMemo(() => (cart.key === storageKey ? cart.items : []), [cart, storageKey])

  const setItems = (update) => setCart((current) => {
    const currentItems = current.key === storageKey ? current.items : readCart(storageKey)
    return { key: storageKey, items: typeof update === 'function' ? update(currentItems) : update }
  })

  useEffect(() => {
    setCart({ key: storageKey, items: readCart(storageKey) })
  }, [storageKey])

  useEffect(() => {
    try {
      sessionStorage.setItem(cart.key, JSON.stringify(cart.items))
    } catch (error) {
      console.error('Unable to save cart:', error)
    }
  }, [cart])

  const addItem = (product, quantity = 1, customer = null, customerSellingPrice = getSuggestedCustomerPrice(product)) => {
    const cartKey = `${product.id}:${customer?.id || 'self'}`
    setItems((prev) => {
      const existing = prev.find((i) => i.cart_key === cartKey)
      if (existing) {
        return prev.map((i) =>
          i.cart_key === cartKey ? { ...i, quantity: Math.min(i.max_stock, i.quantity + quantity), customer_selling_price: Number(customerSellingPrice) || getSuggestedCustomerPrice(i) } : i
        )
      }
      return [
        ...prev,
        {
          product_id: product.id,
          cart_key: cartKey,
          name: product.name,
          price: product.price,
          wholesale_price: product.wholesale_price,
          suggested_retail_price: product.suggested_retail_price,
          customer_selling_price: Number(customerSellingPrice) || getSuggestedCustomerPrice(product),
          discount_tiers: product.discount_tiers || [],
          campaign_discount_percent: product.campaign_discount_percent || 0,
          packed_weight_kg: product.packed_weight_kg,
          packed_length_cm: product.packed_length_cm,
          packed_width_cm: product.packed_width_cm,
          packed_height_cm: product.packed_height_cm,
          product_type: product.product_type,
          fragile: product.fragile,
          keep_upright: product.keep_upright,
          motorcycle_safe: product.motorcycle_safe,
          image: product.images?.[0] || null,
          merchant_id: product.merchant_id,
          quantity,
          max_stock: product.stock_quantity,
          min_order_qty: Number(product.min_order_qty) || 1,
          customer_id: customer?.id || null,
          customer_name: customer?.name || null,
          customer_phone: customer?.phone || null,
          customer_address: customer?.address || null
        }
      ]
    })
  }

  const updateQuantity = (cartKey, quantity) => {
    if (quantity <= 0) {
      removeItem(cartKey)
      return
    }
    setItems((prev) => prev.map((i) => (i.cart_key === cartKey ? { ...i, quantity: Math.max(Number(i.min_order_qty) || 1, Math.min(i.max_stock, quantity)) } : i)))
  }

  const removeItem = (cartKey) => {
    setItems((prev) => prev.filter((i) => i.cart_key !== cartKey))
  }

  const updateSellingPrice = (cartKey, price) => {
    const normalized = Math.max(0, Number(price) || 0)
    setItems((prev) => prev.map((item) => item.cart_key === cartKey ? { ...item, customer_selling_price: normalized } : item))
  }

  const clearCart = () => setItems([])

  const clearMerchantItems = (merchantId) => {
    setItems((prev) => prev.filter((i) => i.merchant_id !== merchantId))
  }

  const clearOrderItems = (merchantId, customerId) => {
    setItems((prev) => prev.filter((item) => !(item.merchant_id === merchantId && (item.customer_id || null) === (customerId || null))))
  }

  // Group by merchant since each order belongs to exactly one merchant
  const groupedByMerchant = useMemo(() => {
    const groups = {}
    for (const item of items) {
      if (!groups[item.merchant_id]) groups[item.merchant_id] = []
      groups[item.merchant_id].push(item)
    }
    return groups
  }, [items])

  const groupedOrders = useMemo(() => {
    const groups = {}
    for (const item of items) {
      const key = `${item.merchant_id}__${item.customer_id || 'self'}`
      if (!groups[key]) groups[key] = { merchantId: item.merchant_id, customerId: item.customer_id, customerName: item.customer_name, customerPhone: item.customer_phone, customerAddress: item.customer_address, items: [] }
      groups[key].items.push(item)
    }
    return groups
  }, [items])

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalAmount = items.reduce((sum, i) => sum + (role === 'reseller' ? getResellerUnitPrice(i, i.quantity) : getUnitPrice(i, i.quantity)) * i.quantity, 0)

  const value = {
    items,
    addItem,
    updateQuantity,
    updateSellingPrice,
    removeItem,
    clearCart,
    clearMerchantItems,
    clearOrderItems,
    groupedByMerchant,
    groupedOrders,
    totalCount,
    totalAmount
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
