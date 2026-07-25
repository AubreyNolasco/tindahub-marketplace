import { AlertTriangle, Loader2, X } from 'lucide-react'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false
}) {
  if (!open) return null

  const confirmStyles = {
    danger: 'bg-coral-600 hover:bg-coral-700 text-white',
    primary: 'bg-teal-600 hover:bg-teal-700 text-white',
    warning: 'bg-mango-500 hover:bg-mango-600 text-ink'
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-ink/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-coral-100 text-coral-600">
              <AlertTriangle size={20} />
            </span>
            <h2 className="font-display font-bold text-ink">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink/30 hover:text-ink rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-5">
          <p className="text-sm leading-6 text-ink/60">{message}</p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="btn-secondary flex-1 py-2.5 text-sm"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition flex items-center justify-center gap-2 ${confirmStyles[variant] || confirmStyles.danger}`}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
