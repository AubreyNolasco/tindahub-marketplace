import { AlertTriangle, Loader2 } from 'lucide-react'
import Modal from './Modal'

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
  const confirmStyles = {
    danger: 'bg-coral-600 hover:bg-coral-700 text-white',
    primary: 'bg-teal-600 hover:bg-teal-700 text-white',
    warning: 'bg-mango-500 hover:bg-mango-600 text-ink'
  }
  const iconTone = variant === 'primary' ? 'teal' : variant === 'warning' ? 'mango' : 'coral'

  return (
    <Modal open={open} onClose={onClose} title={title} icon={AlertTriangle} iconTone={iconTone} size="sm">
      <p className="text-sm leading-6 text-fg-muted">{message}</p>
      <div className="mt-5 flex gap-3">
        <button onClick={onClose} disabled={loading} className="btn-secondary flex-1 py-2.5 text-sm">
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 ${confirmStyles[variant] || confirmStyles.danger}`}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
