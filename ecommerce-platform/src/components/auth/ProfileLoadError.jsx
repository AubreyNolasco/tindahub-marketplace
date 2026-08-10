import { AlertTriangle } from 'lucide-react'

// This is what a real merchant/reseller sees if their profile fails to
// load, so the message needs to read as customer-facing copy -- it used to
// unconditionally add "Run supabase/auth_flow_repair_migration.sql in the
// Supabase SQL Editor", a one-off note for the developer's own past
// debugging that made no sense (and looked broken) shown to an end user
// for any other cause, including a normal transient device-verification
// hiccup (see AuthContext's DEVICE_APPROVAL_REQUIRED handling).
export default function ProfileLoadError({ message, onSignOut }) {
  return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-bg px-4">
    <div className="w-full max-w-lg rounded-3xl border border-coral-200 bg-surface p-7 text-center shadow-xl">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-coral-100 text-coral-600"><AlertTriangle size={26} /></span>
      <h1 className="mt-4 font-display text-xl font-bold text-ink">Unable to load your profile</h1>
      <p className="mt-2 text-sm leading-6 text-ink/60">{message}</p>
      <p className="mt-3 text-xs leading-5 text-ink/45">If this keeps happening, sign out and sign in again. Contact support if the problem continues.</p>
      <button type="button" onClick={onSignOut} className="btn-primary mt-5 w-full">Sign out and return to login</button>
    </div>
  </div>
}
