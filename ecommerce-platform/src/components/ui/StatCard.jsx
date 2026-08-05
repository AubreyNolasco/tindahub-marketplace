import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

const TONES = {
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300',
  mango: 'bg-mango-100 text-mango-700 dark:bg-mango-500/15 dark:text-mango-300',
  coral: 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-300'
}

// KPI tile used by all three role dashboards. `trend` is an optional array
// of { value } points rendered as a faint sparkline; `delta` is an optional
// percentage change shown as an up/down chip.
export default function StatCard({ icon: Icon, label, value, detail, delta, trend, tone = 'teal', to, loading = false }) {
  const gradientId = useId()
  const Wrapper = to ? Link : 'div'
  const wrapperProps = to ? { to } : {}
  const positive = typeof delta === 'number' ? delta >= 0 : null

  return (
    <Wrapper {...wrapperProps} className="card group relative flex flex-col gap-3 overflow-hidden p-5 transition-shadow hover:shadow-elevation-2">
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[tone] || TONES.teal}`}>
            <Icon size={19} />
          </span>
        )}
        {typeof delta === 'number' && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${positive ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' : 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-300'}`}>
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="relative z-10">
        {loading ? <div className="skeleton h-7 w-20 sm:h-8" /> : <p className="font-mono text-2xl font-bold tabular-nums text-fg sm:text-3xl">{value}</p>}
        <p className="mt-0.5 text-sm font-semibold text-fg-muted">{label}</p>
        {detail && <p className="mt-1 text-xs text-fg-muted/80">{detail}</p>}
      </div>
      {trend && trend.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16794B" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#16794B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#16794B" strokeWidth={1.5} fill={`url(#${gradientId})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Wrapper>
  )
}
