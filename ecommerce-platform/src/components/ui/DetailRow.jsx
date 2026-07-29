// Extracted from ActionPopup.jsx (which re-exports these for backward
// compatibility) since the same label/value row + titled section pattern
// was being hand-copied inline in Merchant/Orders.jsx, Reseller/Customers.jsx,
// Reseller/MyReferrals.jsx and order/PurchaseHistory.jsx.
export function DetailRow({ label, value, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-0 ${className}`}>
      <span className="text-sm font-medium text-fg-muted shrink-0 min-w-[120px]">{label}</span>
      <span className="text-sm font-semibold text-fg text-right">{value || '—'}</span>
    </div>
  )
}

export function DetailSection({ title, children }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">{title}</p>
      <div className="rounded-xl bg-surface-inset p-4">{children}</div>
    </div>
  )
}
