const completeAddress = (address = '') => address.trim().length >= 20 && /\d/.test(address) && address.split(',').length >= 3
const roundFive = (amount) => Math.ceil(amount / 5) * 5
const validPackageNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0
const validPackage = (item) => Number.isInteger(Number(item?.quantity)) && validPackageNumber(item.quantity) &&
  validPackageNumber(item.weight_kg) && validPackageNumber(item.length_cm) &&
  validPackageNumber(item.width_cm) && validPackageNumber(item.height_cm)

export function calculateShipping({ merchantAddress, resellerAddress, packages, distanceKm }) {
  const output = { merchant_address: merchantAddress || '', reseller_address: resellerAddress || '', billing_distance_km: 0, total_actual_weight_kg: 0, packed_length_cm: 0, packed_width_cm: 0, packed_height_cm: 0, total_package_volume_cm3: 0, selected_vehicle: '', vehicle_selection_reason: '', base_fare: 0, distance_charge: 0, calculated_shipping_fee: 0, rounded_shipping_fee: 0, shipping_status: 'MANUAL_QUOTATION_REQUIRED', rate_type: 'Standard Estimated Shipping Fee', customer_message: '' }
  if (!completeAddress(merchantAddress) || !completeAddress(resellerAddress)) return { ...output, customer_message: 'Please complete the merchant and reseller addresses before calculating the shipping fee.' }
  if (!packages?.length || packages.some((item) => !validPackage(item))) return { ...output, customer_message: 'Please provide a positive whole-item quantity and positive packed weight and dimensions so we can calculate the correct shipping fee.' }
  const distance = Number(distanceKm)
  if (!Number.isFinite(distance) || distance <= 0) return { ...output, customer_message: 'Please enter the actual road or driving distance before calculating the shipping fee.' }
  const billingDistance = Math.ceil(distance)
  const weight = packages.reduce((sum, item) => sum + Number(item.weight_kg) * Number(item.quantity), 0)
  const volume = packages.reduce((sum, item) => sum + Number(item.length_cm) * Number(item.width_cm) * Number(item.height_cm) * Number(item.quantity), 0)
  const length = Math.max(...packages.map((item) => Number(item.length_cm)))
  const width = Math.max(...packages.map((item) => Number(item.width_cm)))
  const height = Math.max(...packages.map((item) => Number(item.height_cm)))
  const specialHandling = packages.some((item) => item.fragile || item.keep_upright || !item.motorcycle_safe || /cake|food tray|party tray|catering|bottled|arrangement/i.test(item.product_type || ''))
  const totals = { billing_distance_km: billingDistance, total_actual_weight_kg: Number(weight.toFixed(3)), packed_length_cm: length, packed_width_cm: width, packed_height_cm: height, total_package_volume_cm3: Number(volume.toFixed(2)) }
  const sedanFits = weight <= 200 && length <= 100 && width <= 60 && height <= 70 && volume <= 420000
  if (!sedanFits) return { ...output, ...totals, customer_message: 'This order requires a larger delivery vehicle. The shipping fee must be confirmed manually.' }
  const motorcycleFits = !specialHandling && weight <= 20 && length <= 50 && width <= 40 && height <= 50 && volume <= 100000
  const motorcycle = motorcycleFits
  const base = motorcycle ? 49 : 100
  const distanceCharge = billingDistance <= 5 ? billingDistance * (motorcycle ? 6 : 18) : 5 * (motorcycle ? 6 : 18) + (billingDistance - 5) * (motorcycle ? 5 : 15)
  const calculated = base + distanceCharge
  const rounded = roundFive(calculated)
  return { ...output, ...totals, selected_vehicle: motorcycle ? 'Motorcycle' : 'Sedan', vehicle_selection_reason: motorcycle ? 'Smallest vehicle that meets the weight, size, volume, and handling limits.' : 'Sedan selected because of packed size, weight, product type, or handling requirements.', base_fare: base, distance_charge: distanceCharge, calculated_shipping_fee: calculated, rounded_shipping_fee: rounded, shipping_status: 'CALCULATED', customer_message: motorcycle ? `Standard estimated shipping fee: ₱${rounded.toFixed(2)} via Motorcycle. The fee is based on the distance between the merchant and reseller addresses.` : `Standard estimated shipping fee: ₱${rounded.toFixed(2)} via Sedan. Sedan was selected based on the order’s packed size, weight, or handling requirements.` }
}
