import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-5">
        <Compass className="text-teal-500" size={30} />
      </div>
      <p className="font-display font-extrabold text-6xl text-ink">404</p>
      <h1 className="font-display font-semibold text-xl text-ink mt-2">Page Not Found</h1>
      <p className="text-ink/60 mt-1 max-w-sm">
        The link may be incorrect or this page may have moved. Let us return to the homepage.
      </p>
      <Link to="/" className="btn-primary mt-6">Back to Home</Link>
    </div>
  )
}
