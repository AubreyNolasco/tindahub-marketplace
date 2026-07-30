import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Trend-chart card used by dashboard "analytics row" sections (revenue,
// deliveries, sales trend, ...). Renders a friendly empty state instead of
// an empty chart when there isn't enough data yet.
export default function AnalyticsPanel({ title, description, action, data, dataKey = 'value', xKey = 'label', color = '#16794B', valueFormatter, height = 260 }) {
  const gradientId = useId()
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4" style={{ height }}>
        {data?.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} axisLine={false} tickLine={false} width={40} tickFormatter={valueFormatter} />
              <Tooltip
                formatter={(v) => (valueFormatter ? valueFormatter(v) : v)}
                contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: 'rgb(var(--fg))' }}
              />
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-fg-muted">No data yet</div>
        )}
      </div>
    </div>
  )
}
