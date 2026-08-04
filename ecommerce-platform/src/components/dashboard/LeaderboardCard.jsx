import { Trophy } from 'lucide-react'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Spinner from '../ui/Spinner'
import EmptyState from '../ui/EmptyState'

// Rank badge shown at the top of each card. Always #1 for now, but kept
// dynamic so future rank values (e.g. a top-3 list) render without change.
function RankBadge({ rank = 1 }) {
  return (
    <Badge tone="success" className="gap-1">
      <Trophy size={13} />
      <span className="font-mono">#{rank}</span>
    </Badge>
  )
}

// Generic "Top performers" leaderboard card used by the Admin Dashboard for
// Top Product / Top Reseller / Top Merchant. It renders a prominent avatar
// (or product image), the name, and an array of stat rows. Loading, error,
// and empty states are handled internally so the parent stays declarative.
export default function LeaderboardCard({
  title,
  subtitle,
  icon: Icon,
  loading,
  error,
  data,
  onRetry,
  image,
  name,
  stats = [],
  emptyMessage = 'No data yet.'
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
              <Icon size={19} />
            </span>
          )}
          <div>
            <h2 className="font-display font-bold text-fg">{title}</h2>
            {subtitle && <p className="text-xs text-fg-muted">{subtitle}</p>}
          </div>
        </div>
        {!loading && !error && data && <RankBadge rank={data.rank || 1} />}
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <Spinner />
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-fg-muted">Couldn't load this leaderboard.</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-300 dark:hover:bg-teal-500/25"
            >
              Retry
            </button>
          </div>
        ) : !data ? (
          <EmptyState icon={Icon} title="No data yet" message={emptyMessage} />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface-inset ring-1 ring-line">
                {image ? (
                  <img src={image} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-fg-muted">
                    <Icon size={26} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-fg">{name}</p>
                <p className="text-xs text-fg-muted">Top performer</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {stats.map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-surface-inset p-3">
                  <p className="font-mono text-lg font-bold tabular-nums text-fg">{value}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">{label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
