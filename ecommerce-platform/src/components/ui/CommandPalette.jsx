import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

// Global quick-nav (Ctrl/Cmd+K), sourced from the same per-role `sections`
// array WorkspaceLayout already renders as the sidebar — no nav data is
// duplicated. Built on cmdk's core primitives (fuzzy search + keyboard nav)
// inside our own overlay, rather than cmdk's Dialog wrapper, so the look
// matches the rest of the app's modal styling exactly.
export default function CommandPalette({ sections = [] }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const go = (to) => { setOpen(false); navigate(to) }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg-muted transition-colors hover:border-teal-300 hover:text-fg"
      >
        <Search size={15} />
        <span className="hidden sm:inline">Search or jump to...</span>
        <kbd className="ml-1 hidden rounded-md border border-line bg-surface-inset px-1.5 py-0.5 font-mono text-[10px] text-fg-muted sm:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] grid place-items-start justify-center bg-ink/65 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <Command label="Command palette" className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-2xl animate-scale-in">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search size={16} className="shrink-0 text-fg-muted" />
              <Command.Input
                autoFocus
                placeholder="Search pages, actions..."
                className="w-full bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-fg-muted"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="px-4 py-8 text-center text-sm text-fg-muted">No results found.</Command.Empty>
              {sections.map((section) => (
                <Command.Group key={section.label} heading={section.label} className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-fg-muted">
                  {section.items.map((item) => (
                    <Command.Item
                      key={item.to}
                      value={`${section.label} ${item.label}`}
                      onSelect={() => go(item.to)}
                      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-fg data-[selected=true]:bg-teal-50 data-[selected=true]:text-teal-900 dark:data-[selected=true]:bg-teal-500/15 dark:data-[selected=true]:text-teal-300"
                    >
                      {item.icon && <item.icon size={16} className="text-teal-600" />}
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  )
}
