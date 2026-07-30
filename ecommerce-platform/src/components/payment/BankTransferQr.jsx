import { useEffect, useState } from 'react'
import { Copy, Loader2, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { PAYMENT_DESTINATION } from '../../config/payment'

export default function BankTransferQr({ compact = false }) {
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => { QRCode.toDataURL(PAYMENT_DESTINATION.emvcoPayload, { errorCorrectionLevel: 'M', margin: 2, width: 720, color: { dark: '#073B25', light: '#FFFFFF' } }).then(setQrUrl).catch(() => toast.error('Unable to generate the bank transfer QR.')) }, [])
  const copyPayload = async () => { try { await navigator.clipboard.writeText(PAYMENT_DESTINATION.emvcoPayload); toast.success('QR payment payload copied.') } catch { toast.error('Copy is unavailable on this browser.') } }
  return <section className={`rounded-2xl border border-teal-200 bg-teal-50/70 ${compact ? 'p-3' : 'p-4'}`} aria-label="InstaPay QR payment destination"><div className={`grid items-center gap-4 ${compact ? 'grid-cols-[112px_1fr]' : 'sm:grid-cols-[160px_1fr]'}`}><div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-black/5 bg-surface p-2 shadow-sm">{qrUrl ? <img src={qrUrl} alt={`InstaPay QR for ${PAYMENT_DESTINATION.accountName}`} className="h-full w-full" /> : <Loader2 className="animate-spin text-teal-600" />}</div><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-teal-700"><QrCode size={15} /> {PAYMENT_DESTINATION.rail} · {PAYMENT_DESTINATION.method}</p><h3 className="mt-2 font-display text-lg font-bold text-ink">{PAYMENT_DESTINATION.accountName}</h3><p className="mt-1 text-xs leading-5 text-ink/55">Scan this QR in a participating bank or e-wallet app. Verify the account name before sending.</p><button type="button" onClick={copyPayload} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-xs font-bold text-teal-700 shadow-sm"><Copy size={13} /> Copy QR payload</button></div></div></section>
}
