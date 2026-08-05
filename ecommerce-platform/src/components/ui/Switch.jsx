// Shared toggle switch — the exact markup hand-duplicated identically
// across Admin/DeliveryProviders.jsx, Merchant/DeliverySettings.jsx, and
// Reseller/DeliverySettings.jsx. Presentation only: callers still own
// the checked/onChange state exactly as before.

export default function Switch({ checked, onChange, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-teal-600' : 'bg-ink/20'} ${className}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )
}
