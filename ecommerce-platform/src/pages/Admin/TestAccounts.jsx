import { ShieldAlert } from 'lucide-react'

export default function TestAccounts() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Test Accounts</h1>
        <p className="mt-1 text-sm text-ink/50">Legacy demo accounts have been removed.</p>
      </div>

      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mango-100 text-mango-700"><ShieldAlert size={26} /></span>
        <p className="font-bold text-ink">No test accounts configured</p>
        <p className="max-w-sm text-sm text-ink/50">
          merchant@gmail.com and reseller@gmail.com were deleted. Admin testing and demos now go through
          a full-access admin account instead.
        </p>
      </div>
    </div>
  )
}
