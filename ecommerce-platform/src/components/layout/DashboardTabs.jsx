import { NavLink } from 'react-router-dom'

export default function DashboardTabs({ tabs }) {
  return (
    <div className="border-b border-black/5 bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                isActive ? 'border-teal-500 text-teal-700' : 'border-transparent text-ink/50 hover:text-ink/80'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
