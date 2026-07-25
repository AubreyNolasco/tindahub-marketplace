import { X } from 'lucide-react'

export default function ActionPopup({ open, onClose, title, subtitle, children, size = 'md' }) {
  if (!open) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/65 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full ${sizeClasses[size] || sizeClasses.md} overflow-y-auto rounded-3xl bg-white shadow-2xl`}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-white/95 backdrop-blur rounded-t-3xl px-6 pt-5 pb-4 border-b border-black/[0.04]">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink truncate">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-ink/50">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 grid h-9 w-9 place-items-center rounded-xl text-ink/40 hover:bg-ink/5 hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export function DetailRow({ label, value, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2.5 border-b border-black/[0.03] last:border-0 ${className}`}>
      <span className="text-sm font-medium text-ink/50 shrink-0 min-w-[120px]">{label}</span>
      <span className="text-sm font-semibold text-ink text-right">{value || '—'}</span>
    </div>
  )
}

export function DetailSection({ title, children }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-xs font-bold uppercase tracking-wider text-ink/40 mb-2">{title}</p>
      <div className="rounded-xl bg-cream p-4">{children}</div>
    </div>
  )
}
