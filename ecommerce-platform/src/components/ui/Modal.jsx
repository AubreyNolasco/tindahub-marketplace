import { useEffect } from 'react'
import { X } from 'lucide-react'

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

const ICON_TONES = {
  teal: 'bg-teal-100 text-teal-700',
  coral: 'bg-coral-100 text-coral-600',
  mango: 'bg-mango-100 text-mango-700'
}

// Shared overlay/dialog shell — extracted from the pre-existing
// ConfirmDialog/ActionPopup markup so every modal in the app looks and
// behaves the same (Escape to close, backdrop click to close, consistent
// header/footer layout) instead of each one reinventing it.
//
// Deliberately static (bg-white/text-ink), NOT dark-mode-aware: this modal
// is used by ConfirmDialog/ActionPopup, which render arbitrary `children`
// supplied by callers across several legacy pages (Merchant/Orders,
// Reseller/Customers, Reseller/MyReferrals, order/PurchaseHistory) that
// still use static text-ink styling, not the new text-fg tokens. Making
// the panel background flip dark while that content stays static-dark
// text would make it unreadable — same bug this component was patched to
// avoid. Revisit once those callers are migrated to the token system.
export default function Modal({ open, onClose, title, subtitle, icon: Icon, iconTone = 'teal', size = 'md', footer, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-ink/65 p-3 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className={`max-h-[92vh] w-full ${SIZES[size] || SIZES.md} overflow-y-auto rounded-3xl bg-white shadow-2xl animate-scale-in`}>
        {(title || onClose) && (
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-3xl border-b border-black/[0.04] bg-white/95 px-6 pb-4 pt-5 backdrop-blur">
            <div className="flex min-w-0 items-center gap-3">
              {Icon && (
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${ICON_TONES[iconTone] || ICON_TONES.teal}`}>
                  <Icon size={20} />
                </span>
              )}
              <div className="min-w-0">
                {title && <h2 className="truncate font-display text-lg font-bold text-ink">{title}</h2>}
                {subtitle && <p className="mt-1 text-sm text-ink/50">{subtitle}</p>}
              </div>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="border-t border-black/[0.04] px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}
