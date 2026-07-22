const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function validateImage(file) {
  if (!file) return 'Please select an image.'
  if (!IMAGE_TYPES.has(file.type)) return 'Only JPG, PNG, and WebP images are allowed.'
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return 'Image must be smaller than 5 MB.'
  return null
}

export function safeUploadPath(userId, prefix, file) {
  const extension = IMAGE_EXTENSIONS[file.type]
  if (!userId || !extension) throw new Error('Invalid upload information.')
  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${userId}/${prefix}-${token}.${extension}`
}

export function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength)
}

export function containsContactInfo(value) {
  const text = String(value ?? '').toLowerCase()
  const patterns = [
    /[a-z0-9._%+-]+\s*(?:@|\[at\]|\(at\)| at )\s*[a-z0-9.-]+\s*(?:\.|\[dot\]|\(dot\)| dot )\s*[a-z]{2,}/i,
    /(?:^|\D)(?:\+?\s*63|0)[\s().-]*9[\d\s().-]{8,12}(?:\D|$)/,
    /(?:^|\D)\d{3,4}[\s.-]\d{3,4}[\s.-]\d{3,4}(?:\D|$)/,
    /(?:^|\D)\d{8,15}(?:\D|$)/,
    /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|ph|io|me)(?:\/|\s|$))/i,
    /(?:^|\s)@[a-z0-9._-]{3,}/i,
    /(?:facebook|fb|messenger|instagram|insta|telegram|whatsapp|viber|wechat|signal|discord|tiktok)\s*[:\-]?\s*(?:id|user(?:name)?|account|handle|number|no\.)/i,
    /(?:text|call|message|contact|dm|pm)\s+(?:me|us)\s+(?:at|on|via)/i
  ]
  return patterns.some((pattern) => pattern.test(text))
}

export function containsAddressInfo(value) {
  const text = String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const addressWords = /\b(?:address|lokasyon|location|pickup|pick[- ]?up|deliver(?:y)?|house|unit|building|bldg|floor|street|st\.?|road|rd\.?|avenue|ave\.?|barangay|brgy\.?|city|province|subdivision|village|phase|block|blk\.?|lot|purok|sitio|postal|zip(?:code)?)\b/i
  const locationPattern = /\b(?:unit|house|building|bldg|floor|block|blk|lot|phase|purok|sitio|barangay|brgy)\s*(?:no\.?\s*)?[a-z0-9-]+/i
  const structuredAddress = /\d+[a-z]?\s+[a-z][a-z .'-]{2,}(?:street|st\.?|road|rd\.?|avenue|ave\.?|subdivision|village)\b/i
  return locationPattern.test(text) || structuredAddress.test(text) || (addressWords.test(text) && /\d|\b(?:near|beside|across|corner|landmark)\b/i.test(text))
}
