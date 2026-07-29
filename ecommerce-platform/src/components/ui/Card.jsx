// Wraps the existing .card Tailwind class (index.css) — same visual
// language as every card already in the app, plus optional header/footer
// slots so pages stop hand-rolling that layout each time.
export default function Card({ as: Tag = 'div', header, footer, padded = true, className = '', children, ...props }) {
  return (
    <Tag className={`card ${padded ? 'p-6' : ''} ${className}`} {...props}>
      {header && <div className="mb-4 flex items-center justify-between gap-3">{header}</div>}
      {children}
      {footer && <div className="mt-4 border-t border-line pt-4">{footer}</div>}
    </Tag>
  )
}
