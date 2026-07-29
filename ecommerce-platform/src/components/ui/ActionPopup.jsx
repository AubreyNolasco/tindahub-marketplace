import Modal from './Modal'

export default function ActionPopup({ open, onClose, title, subtitle, children, size = 'md' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} size={size}>
      {children}
    </Modal>
  )
}

// Re-exported for backward compatibility — several pages import DetailRow/
// DetailSection from here; the canonical implementation now lives in
// ./DetailRow so it can be imported without pulling in the modal too.
export { DetailRow, DetailSection } from './DetailRow'
