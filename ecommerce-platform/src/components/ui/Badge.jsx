const TONES = {
  success: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  warning: 'bg-mango-100 text-mango-700 dark:bg-mango-500/15 dark:text-mango-300',
  danger: 'bg-coral-100 text-coral-700 dark:bg-coral-500/15 dark:text-coral-300',
  neutral: 'bg-surface-inset text-fg-muted',
  info: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
}

export default function Badge({ tone = 'neutral', dot = false, className = '', children }) {
  return (
    <span className={`badge ${TONES[tone] || TONES.neutral} ${className}`}>
      {dot && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
