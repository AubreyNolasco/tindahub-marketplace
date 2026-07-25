const DEVICE_STORAGE_KEY = 'jomhub_device_id'

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_STORAGE_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function getDeviceLabel() {
  return `${/Mobi|Android/i.test(navigator.userAgent) ? 'Mobile phone' : 'Computer'} - ${navigator.platform || 'Unknown device'}`
}
