// Deliberately does NOT use the shared .card Tailwind class — that class
// is static (bg-surface) because ~65 legacy pages pair it with static
// text-ink content. This component uses the bg-surface/border-line tokens
// directly instead, so it stays dark-mode-correct without touching those
// pages. Only use this component (not className="card") in code that also
// uses text-fg/text-fg-muted for its text.
export default function Card({ as: Tag = 'div', header, footer, padded = true, className = '', children, ...props }) {
  return (
    <Tag className={`rounded-xl2 shadow-card border border-line bg-surface ${padded ? 'p-6' : ''} ${className}`} {...props}>
      {header && <div className="mb-4 flex items-center justify-between gap-3">{header}</div>}
      {children}
      {footer && <div className="mt-4 border-t border-line pt-4">{footer}</div>}
    </Tag>
  )
}
