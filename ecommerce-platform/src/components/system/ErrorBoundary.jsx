import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
export default class ErrorBoundary extends Component {
  state = { failed: false, message: '' }
  static getDerivedStateFromError(error) { return { failed: true, message: error?.message || 'Unknown interface error' } }
  componentDidCatch(error, info) { console.error('RM HUB interface error:', error, info) }
  render() { if (!this.state.failed) return this.props.children; return <div className="flex min-h-screen items-center justify-center bg-cream p-4"><div className="w-full max-w-md rounded-3xl border border-coral-100 bg-white p-8 text-center shadow-soft"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-coral-100 text-coral-600"><AlertTriangle size={27} /></span><h1 className="mt-5 font-display text-2xl font-bold text-ink">Something went wrong</h1><p className="mt-2 text-sm leading-6 text-ink/55">Your data is safe. Refresh this page to reload the RM HUB interface.</p><code className="mt-4 block break-words rounded-xl bg-black/5 p-3 text-left text-xs text-coral-700">{this.state.message}</code><button onClick={() => window.location.reload()} className="btn-primary mt-6 inline-flex items-center gap-2"><RefreshCw size={16} /> Refresh page</button></div></div> }
}
