import { useEffect, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import Modal from './Modal'

// Styled replacement for window.prompt() -- used across Admin/Merchant
// review screens for rejection reasons, schedule dates, and transfer
// references. Native prompt() looks jarring next to the rest of this
// app's design, can't be pre-filled reliably, and silently discards
// whatever was typed if the dialog is dismissed by accident.
export default function PromptModal({
  open, onClose, onSubmit, title, message, label, placeholder = '',
  defaultValue = '', required = false, type = 'text', submitText = 'Submit',
  loading = false
}) {
  const [value, setValue] = useState(defaultValue)
  useEffect(() => { if (open) setValue(defaultValue) }, [open, defaultValue])
  const canSubmit = !required || value.trim().length > 0

  return (
    <Modal open={open} onClose={onClose} title={title} icon={MessageSquare} size="sm">
      {message && <p className="text-sm leading-6 text-fg-muted">{message}</p>}
      <label className="mt-4 block text-sm font-semibold text-fg">
        {label}
        {type === 'textarea' ? (
          <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} rows={3} className="input-field mt-1.5" autoFocus />
        ) : (
          <input type={type} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="input-field mt-1.5" autoFocus />
        )}
      </label>
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onClose} disabled={loading} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
        <button
          type="button"
          onClick={() => onSubmit(value.trim())}
          disabled={loading || !canSubmit}
          className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {submitText}
        </button>
      </div>
    </Modal>
  )
}
