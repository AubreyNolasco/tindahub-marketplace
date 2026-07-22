import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cleanText, containsAddressInfo, containsContactInfo } from '../../utils/security'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

export default function ChatThread({ merchantId, resellerId, title, subtitle, onBack, readOnly = false }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    load()

    const channel = supabase
      .channel(`chat:${merchantId}:${resellerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          if (payload.new.reseller_id !== resellerId) return
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, resellerId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('reseller_id', resellerId)
      .order('created_at', { ascending: true })
    if (error) toast.error(error.message)
    setMessages(data || [])
    setLoading(false)

    if (!readOnly) {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('merchant_id', merchantId)
        .eq('reseller_id', resellerId)
        .eq('is_read', false)
        .neq('sender_id', user.id)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const message = cleanText(text, 2000)
    if (!message) return
    if (containsContactInfo(message) || containsAddressInfo(message)) {
      toast.error('Contact details and addresses are not allowed in chat. Keep transactions inside JOM HUB.')
      return
    }
    setSending(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        merchant_id: merchantId,
        reseller_id: resellerId,
        sender_id: user.id,
        message
      })
      .select()
      .maybeSingle()
    setSending(false)
    if (error) {
      toast.error(['CONTACT_INFO_NOT_ALLOWED_IN_CHAT', 'ADDRESS_NOT_ALLOWED_IN_CHAT'].includes(error.message)
        ? 'Contact details and addresses are not allowed in chat. Keep transactions inside JOM HUB.'
        : error.message)
      return
    }
    setText('')
    if (!data) {
      await load()
      return
    }
    // Append immediately rather than waiting on the realtime event, which
    // only fires once chat_messages has been added to the supabase_realtime
    // publication (see chat_realtime_migration.sql).
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
  }

  return (
    <div className="card flex flex-col h-[70vh]">
      <div className="flex items-center gap-3 p-4 border-b border-black/5 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-teal-50 text-ink/60">
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <p className="font-semibold text-ink">{title}</p>
          {subtitle && <p className="text-xs text-ink/50">{subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-ink/40 text-center py-8">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-ink/40 text-center py-8">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((m) => {
            const isOwn = !readOnly && m.sender_id === user.id
            return (
              <div key={m.id} className={`flex ${readOnly ? 'flex-col' : isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    readOnly
                      ? 'bg-teal-50 text-ink'
                      : isOwn
                      ? 'bg-teal-500 text-white rounded-br-sm'
                      : 'bg-teal-50 text-ink rounded-bl-sm'
                  }`}
                >
                  {readOnly && (
                    <p className="text-[11px] font-semibold text-teal-700 mb-0.5">
                      {m.sender_id === merchantId ? 'Merchant' : 'Reseller'}
                    </p>
                  )}
                  <p>{m.message}</p>
                  <p className={`text-[10px] mt-1 ${isOwn ? 'text-teal-100' : 'text-ink/40'}`}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <div className="border-t border-black/5 flex-shrink-0">
        <div className="flex items-start gap-2 bg-teal-50 px-4 py-2.5 text-[11px] leading-4 text-teal-800"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><span>For your protection, addresses, phone numbers, emails, links, and social media accounts are not allowed. Merchant pickup details remain private.</span></div>
        <form onSubmit={handleSend} className="flex items-center gap-2 p-3">
          <input
            className="input-field flex-1"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
          <button type="submit" disabled={sending || !text.trim()} className="btn-primary p-2.5 flex-shrink-0">
            <Send size={18} />
          </button>
        </form>
        </div>
      )}
    </div>
  )
}
