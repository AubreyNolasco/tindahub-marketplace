export default function SummaryCards({ cards }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {cards.map((card) => (
        <div key={card.label} className="card p-5">
          <card.icon className="text-teal-500 mb-3" size={22} />
          <p className="text-2xl font-display font-bold text-ink">{card.value}</p>
          <p className="text-sm text-ink/60">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
