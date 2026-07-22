export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-4">
          <Icon className="text-teal-500" size={26} />
        </div>
      )}
      <h3 className="font-display font-semibold text-lg text-ink">{title}</h3>
      {message && <p className="text-ink/60 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
