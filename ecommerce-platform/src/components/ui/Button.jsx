import { Loader2 } from 'lucide-react'

// Variants wrap the existing .btn-primary/.btn-secondary/.btn-accent
// Tailwind classes (index.css) so this stays visually consistent with
// every pre-existing button in the app rather than introducing a second
// button language.
const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  ghost: 'font-semibold rounded-xl text-fg/70 transition-colors hover:bg-surface-inset hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed',
  danger: 'font-semibold rounded-xl bg-coral-600 text-white shadow-sm shadow-coral-900/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-coral-700 hover:shadow-lg active:translate-y-0 disabled:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed'
}

// Tailwind's utilities layer is emitted after @layer components, so these
// size utilities win over the padding/text-size baked into .btn-* above —
// safe to apply across every variant.
const SIZES = {
  sm: 'px-3.5 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base'
}

// `as` lets callers render this as e.g. react-router's <Link> (as={Link}
// to="...") while keeping the exact same variant/size/icon styling as a
// real <button> — disabled/loading only make sense for <button>, so they're
// dropped when rendering as something else.
export default function Button({ as: Tag = 'button', variant = 'primary', size = 'md', loading = false, icon: Icon, className = '', children, disabled, ...props }) {
  const classes = `inline-flex items-center justify-center gap-2 ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`
  const content = <>{loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}{children}</>

  if (Tag === 'button') {
    return <button className={classes} disabled={disabled || loading} {...props}>{content}</button>
  }
  return <Tag className={classes} {...props}>{content}</Tag>
}
