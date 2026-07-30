import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send, Smile } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

const QUICK_EMOJIS = [
  '😀', '😂', '🙂', '😊', '😍', '👍', '👎', '🙏',
  '❤️', '🔥', '🎉', '👏', '😢', '😡', '🤔', '👋',
  '💪', '✅', '❌', '📦', '💰', '🛒', '📍', '⏰'
]

export default function SupportChatThread({ threadUserId, title, subtitle, onBack }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const bottomRef = useRef(null)
  const emojiRef = useRef(null)

  useEffect(() => {
    if (!showEmoji) return
    const close = (event) => { if (emojiRef.current && !emojiRef.current.contains(event.target)) setShowEmoji(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showEmoji])

  useEffect(() => {
    load()

    const channel = supabase
      .channel(`support-chat:${threadUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `user_id=eq.${threadUserId}` },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', threadUserId)
      .order('created_at', { ascending: true })
    if (error) toast.error(error.message)
    setMessages(data || [])
    setLoading(false)

    await supabase
      .from('support_messages')
      .update({ is_read: true })
      .eq('user_id', threadUserId)
      .eq('is_read', false)
      .neq('sender_id', user.id)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const message = text.trim().slice(0, 2000)
    if (!message) return
    setSending(true)
    const { data, error } = await supabase
      .from('support_messages')
      .insert({ user_id: threadUserId, sender_id: user.id, message })
      .select()
      .maybeSingle()
    setSending(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setText('')
    if (!data) {
      await load()
      return
    }
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
            const isOwn = m.sender_id === user.id
            return (
              <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    isOwn ? 'bg-teal-500 text-white rounded-br-sm' : 'bg-teal-50 text-ink rounded-bl-sm dark:bg-teal-500/15'
                  }`}
                >
                  <p>{m.message}</p>
                  <p className={`text-[10px] mt-1 ${isOwn ? 'text-teal-100' : 'text-ink/40'}`}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative border-t border-black/5 flex-shrink-0">
        {showEmoji && (
          <div ref={emojiRef} className="absolute bottom-full left-3 z-10 mb-2 grid grid-cols-8 gap-1 rounded-2xl border border-black/10 bg-surface p-3 shadow-2xl">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { setText((current) => (current + emoji).slice(0, 2000)); setShowEmoji(false) }}
                className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-teal-50"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => setShowEmoji((value) => !value)}
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl text-ink/50 hover:bg-teal-50 hover:text-teal-700"
            aria-label="Add emoji"
          >
            <Smile size={19} />
          </button>
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
    </div>
  )
}
