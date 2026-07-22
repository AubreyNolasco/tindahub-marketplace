import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ExternalLink, Send, Sparkles, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { answerJomBits, getJomBitsSuggestions } from '../../config/jomBitsKnowledge'

export default function JomBits({ publicMode = false }) {
  const { user, profile, role } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [audience, setAudience] = useState('reseller')
  const activeRole = ['reseller', 'merchant'].includes(role) ? role : audience
  const storageKey = user ? `jom_bits_${activeRole}_${user.id}` : publicMode ? `jom_bits_public_${activeRole}` : ''
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || (publicMode && !user ? 'there' : activeRole === 'merchant' ? 'Merchant' : 'Reseller')
  const welcome = useMemo(() => ({ from: 'assistant', title: `Hello, ${firstName}!`, answer: `I am JOM Bits, your ${activeRole} system assistant. I can explain JOM HUB features and the process for this account type.` }), [firstName, activeRole])
  const [messages, setMessages] = useState([welcome])
  const endRef = useRef(null)

  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
      setMessages(Array.isArray(saved) && saved.length ? saved.slice(-12) : [welcome])
    } catch { setMessages([welcome]) }
  }, [storageKey, welcome])
  useEffect(() => {
    if (!storageKey) return
    try { sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-12))) } catch { /* restricted storage */ }
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, storageKey])
  useEffect(() => { if (open) endRef.current?.scrollIntoView() }, [open])

  if (!publicMode && !['reseller', 'merchant'].includes(role)) return null
  const ask = (text) => {
    const clean = text.trim().slice(0, 500)
    if (!clean) return
    const response = answerJomBits(clean, activeRole, location.pathname)
    setMessages((current) => [...current, { from: 'user', answer: clean }, { from: 'assistant', ...response }].slice(-12))
    setQuestion('')
  }
  const submit = (event) => { event.preventDefault(); ask(question) }
  const suggestions = getJomBitsSuggestions(activeRole)
  const openRoute = (route, event) => {
    const anchor = route?.startsWith('/#') ? route.slice(2) : ''
    if (anchor && location.pathname === '/') {
      event?.preventDefault()
      setOpen(false)
      window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      return
    }
    setOpen(false)
  }

  return <>
    <button type="button" onClick={() => setOpen((value) => !value)} style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))', right: 'max(1rem, env(safe-area-inset-right))' }} className="fixed z-[70] grid h-14 w-14 place-items-center rounded-full bg-teal-700 text-white shadow-2xl shadow-teal-950/30 transition hover:-translate-y-0.5 hover:bg-teal-800 sm:h-16 sm:w-16" aria-label={open ? 'Close JOM Bits assistant' : 'Open JOM Bits assistant'} aria-expanded={open}><Bot size={26}/><span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-mango-400"/></button>
    {open && <section style={{ bottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 4.5rem)', right: 'max(.75rem, env(safe-area-inset-right))' }} className="fixed z-[69] flex h-[min(620px,calc(100dvh-6.5rem-env(safe-area-inset-bottom)))] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl shadow-ink/25 sm:w-[390px]" role="dialog" aria-labelledby="jom-bits-title">
        <header className="flex items-center gap-3 bg-gradient-to-br from-teal-950 to-teal-700 px-4 py-3.5 text-white"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Sparkles size={19} className="text-mango-300"/></span><div className="min-w-0 flex-1"><h2 id="jom-bits-title" className="font-display text-base font-bold">JOM Bits</h2><p className="text-[11px] capitalize text-white/65">{activeRole} system assistant · Online</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Close JOM Bits"><X size={18}/></button></header>
        {publicMode && !['reseller','merchant'].includes(role) && <div className="grid grid-cols-2 gap-2 border-b border-black/5 bg-white p-3"><button type="button" onClick={() => { setAudience('reseller'); setMessages([]) }} className={`rounded-xl px-3 py-2 text-xs font-bold ${activeRole === 'reseller' ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-800'}`}>I am a Reseller</button><button type="button" onClick={() => { setAudience('merchant'); setMessages([]) }} className={`rounded-xl px-3 py-2 text-xs font-bold ${activeRole === 'merchant' ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-800'}`}>I am a Merchant</button></div>}
        <div className="border-b border-black/5 bg-teal-50 px-4 py-2 text-[11px] leading-4 text-teal-900">Private role-aware guidance. JOM Bits answers only from approved JOM HUB processes and does not send your data to a third party.</div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-cream/60 p-4" aria-live="polite">{messages.map((message, index) => <div key={`${message.from}-${index}`} className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.from === 'user' ? 'rounded-br-md bg-teal-700 text-white' : 'rounded-bl-md border border-black/5 bg-white text-ink/70 shadow-sm'}`}>{message.title && <p className="mb-1 font-bold text-ink">{message.title}</p>}<p>{message.answer}</p>{message.from === 'assistant' && message.route && !(message.route === location.pathname) && <Link to={message.route} onClick={(event) => openRoute(message.route, event)} className="mt-2 inline-flex items-center gap-1 font-bold text-teal-700">{message.actionLabel || 'Open relevant page'} <ExternalLink size={13}/></Link>}</div></div>)}<div ref={endRef}/></div>
        <div className="border-t border-black/5 bg-white p-3"><div className="mb-3 flex gap-2 overflow-x-auto pb-1">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => ask(suggestion)} className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100">{suggestion}</button>)}</div><form onSubmit={submit} className="flex items-end gap-2"><label className="sr-only" htmlFor="jom-bits-question">Ask JOM Bits</label><textarea id="jom-bits-question" rows="1" maxLength="500" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(question) } }} placeholder="Ask about your JOM HUB account..." className="input-field max-h-28 min-h-11 flex-1 resize-none py-3 text-sm"/><button type="submit" disabled={!question.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-700 text-white hover:bg-teal-800 disabled:bg-black/15" aria-label="Send question"><Send size={17}/></button></form></div>
    </section>}
  </>
}
