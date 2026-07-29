import { useEffect } from 'react'
import { X } from 'lucide-react'

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

const ICON_TONES = {
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  coral: 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-300',
  mango: 'bg-mango-100 text-mango-700 dark:bg-mango-500/15 dark:text-mango-300'
}

// Shared overlay/dialog shell — extracted from the pre-existing
// ConfirmDialog/ActionPopup markup so every modal in the app looks and
// behaves the same (Escape to close, backdrop click to close, consistent
// header/footer layout) instead of each one reinventing it.
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
      <div className={`max-h-[92vh] w-full ${SIZES[size] || SIZES.md} overflow-y-auto rounded-3xl bg-surface shadow-2xl animate-scale-in`}>
        {(title || onClose) && (
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-3xl border-b border-line bg-surface px-6 pb-4 pt-5">
            <div className="flex min-w-0 items-center gap-3">
              {Icon && (
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${ICON_TONES[iconTone] || ICON_TONES.teal}`}>
                  <Icon size={20} />
                </span>
              )}
              <div className="min-w-0">
                {title && <h2 className="truncate font-display text-lg font-bold text-fg">{title}</h2>}
                {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
              </div>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg" aria-label="Close">
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}
