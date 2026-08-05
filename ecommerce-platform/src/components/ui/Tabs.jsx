// Shared filter-pill tab strip — the exact markup that was hand-duplicated
// across Admin/MerchantFollowups.jsx, Merchants.jsx, ResellerVerifications.jsx,
// TopupRequests.jsx, and WithdrawalRequests.jsx. Presentation only: callers
// still own the `value`/`onChange` state and filtering logic exactly as
// before, this just renders the pill strip.

export default function Tabs({ options, value, onChange, className = '' }) {
  const items = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option))
  return (
    <div className={`mb-6 flex gap-2 overflow-x-auto pb-2 ${className}`} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold capitalize ${value === item.value ? 'bg-teal-500 text-white' : 'bg-surface text-ink/60 border border-black/10'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
