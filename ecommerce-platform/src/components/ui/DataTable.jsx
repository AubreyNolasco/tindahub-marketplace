import { useState, useMemo } from 'react'
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, Eye, Edit3, Trash2, MoreHorizontal } from 'lucide-react'

const ITEMS_PER_PAGE = 10

export default function DataTable({
  columns = [],
  data = [],
  actions = [],
  onView,
  onEdit,
  onDelete,
  searchable = true,
  searchPlaceholder = 'Search...',
  emptyTitle = 'No data found',
  emptyMessage = 'No records to display.',
  loading = false,
  loadingRows = 5
}) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const val = col.accessor ? String(row[col.accessor] || '') : ''
        return val.toLowerCase().includes(q)
      })
    )
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? ''
      const bVal = b[sortKey] ?? ''
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE))
  const paged = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const renderCell = (row, col) => {
    if (col.render) return col.render(row)
    const val = row[col.accessor]
    if (col.format === 'currency') return `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    if (col.format === 'date') {
      if (!val) return '—'
      return new Date(val).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    }
    if (col.format === 'datetime') {
      if (!val) return '—'
      return new Date(val).toLocaleString('en-PH')
    }
    if (col.format === 'capitalize') return String(val || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    if (col.format === 'badge') {
      const styles = {
        pending: 'bg-mango-100 text-mango-700',
        confirmed: 'bg-teal-50 text-teal-700',
        completed: 'bg-teal-500/15 text-teal-700',
        cancelled: 'bg-coral-100 text-coral-700',
        processing: 'bg-teal-100 text-teal-700',
        shipped: 'bg-teal-100 text-teal-700',
        active: 'bg-teal-100 text-teal-700',
        inactive: 'bg-ink/10 text-ink/50',
        approved: 'bg-teal-100 text-teal-700',
        rejected: 'bg-coral-100 text-coral-700',
        paid: 'bg-teal-100 text-teal-700',
        unpaid: 'bg-mango-100 text-mango-700'
      }
      const label = String(val || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      return <span className={`badge ${styles[val] || 'bg-ink/10 text-ink/60'}`}>{label}</span>
    }
    return val ?? '—'
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: loadingRows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {columns.map((_, j) => (
              <div key={j} className="h-10 flex-1 rounded-lg bg-ink/5" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Search */}
      {searchable && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="input-field w-full max-w-sm pl-9 py-2.5 text-sm"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-black/[0.06] bg-white shadow-sm">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] bg-cream/80">
              {columns.map((col) => (
                <th
                  key={col.accessor || col.header}
                  className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-ink/50 ${col.sortable !== false ? 'cursor-pointer select-none hover:text-ink/80' : ''}`}
                  onClick={() => col.sortable !== false && col.accessor && toggleSort(col.accessor)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable !== false && col.accessor && (
                      <ArrowUpDown size={12} className={`transition-colors ${sortKey === col.accessor ? 'text-teal-600' : 'text-ink/20'}`} />
                    )}
                  </span>
                </th>
              ))}
              {(actions.length > 0 || onView || onEdit || onDelete) && (
                <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-ink/50 w-[100px]">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions.length > 0 || onView || onEdit || onDelete ? 1 : 0)} className="px-4 py-16 text-center">
                  <p className="font-semibold text-ink/70">{emptyTitle}</p>
                  <p className="mt-1 text-sm text-ink/45">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paged.map((row, rowIndex) => (
                <tr key={row.id || rowIndex} className="transition-colors hover:bg-teal-50/50 group">
                  {columns.map((col) => (
                    <td key={col.accessor || col.header} className="px-4 py-3.5 text-ink/80">
                      {renderCell(row, col)}
                    </td>
                  ))}
                  {(actions.length > 0 || onView || onEdit || onDelete) && (
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {onView && (
                          <button
                            onClick={() => onView(row)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-teal-600 hover:bg-teal-100"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-teal-100 hover:text-teal-600"
                            title="Edit"
                          >
                            <Edit3 size={15} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-coral-100 hover:text-coral-600"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                        {actions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => action.onClick(row)}
                            className={`grid h-8 w-8 place-items-center rounded-lg ${action.className || 'text-ink/50 hover:bg-teal-100'}`}
                            title={action.label}
                          >
                            {action.icon || <MoreHorizontal size={15} />}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink/60">
          <p>
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 disabled:opacity-30 hover:bg-teal-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[3rem] text-center font-semibold text-ink">{page}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 disabled:opacity-30 hover:bg-teal-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
