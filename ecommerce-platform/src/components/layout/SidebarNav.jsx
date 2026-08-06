import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react'

// Shared sidebar nav-list renderer used by AdminLayout, and by
// WorkspaceLayout (Reseller + Merchant) — one search box, one grouping/
// collapse behavior, one active/hover treatment, kept in sync everywhere
// instead of three near-identical hand-rolled copies.
export default function SidebarNav({ sections, collapsed, currentPath, onNavigate }) {
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set())

  const toggleGroup = (label) => setCollapsedGroups((prev) => {
    const next = new Set(prev)
    next.has(label) ? next.delete(label) : next.add(label)
    return next
  })

  const hasQuery = query.trim().length > 0
  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections
      .map((section) => ({ ...section, items: section.items.filter((item) => item.label.toLowerCase().includes(q)) }))
      .filter((section) => section.items.length > 0)
  }, [sections, query])

  return (
    <>
      {!collapsed && (
        <div className="px-3 pb-2 pt-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search menu…"
              aria-label="Search menu"
              className="w-full rounded-xl border border-line bg-surface-inset py-2 pl-9 pr-8 text-sm text-fg placeholder:text-fg-muted transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            {hasQuery && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-fg-muted transition hover:bg-surface hover:text-fg">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-5 scrollbar-thin">
        {filteredSections.length === 0 && (
          <p className="px-3 py-8 text-center text-xs leading-5 text-fg-muted">No menu items match "{query}".</p>
        )}
        {filteredSections.map((section) => {
          const isOpen = hasQuery || !collapsedGroups.has(section.label)
          return (
            <div key={section.label} className="py-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(section.label)}
                  className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted transition hover:text-fg"
                  aria-expanded={isOpen}
                >
                  <span>{section.label}</span>
                  <ChevronDown size={13} className={`shrink-0 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
                </button>
              )}
              {(collapsed || isOpen) && (
                <div className="space-y-1">
                  {section.items.map(({ to, label, icon: Icon, end, badge, highlight }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      data-guide-current-nav={currentPath === to || (!end && currentPath.startsWith(to)) ? 'true' : undefined}
                      className={({ isActive }) => `group relative flex min-h-10 items-center rounded-xl text-sm font-semibold transition-all ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${highlight ? 'bg-coral-600 text-white hover:bg-coral-700' : isActive ? 'bg-teal-600 text-white shadow-md shadow-teal-900/10' : 'text-fg-muted hover:bg-teal-50 hover:text-fg dark:hover:bg-teal-500/10'}`}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={17} className={`shrink-0 ${highlight || isActive ? 'text-white' : 'text-teal-600 group-hover:text-teal-700'}`} />
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{label}</span>
                              {badge > 0 && <span className={`grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1 text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-coral-500 text-white'}`}>{badge > 9 ? '9+' : badge}</span>}
                              {isActive && !highlight && <ChevronRight size={14} className="text-white" />}
                            </>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </>
  )
}
