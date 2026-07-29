import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PageHeader({ title, description, breadcrumbs, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs?.length > 0 && (
          <nav className="mb-1.5 flex flex-wrap items-center gap-1 text-xs font-semibold text-fg-muted">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} />}
                {crumb.to ? <Link to={crumb.to} className="hover:text-teal-600">{crumb.label}</Link> : <span>{crumb.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
