import { useEffect, useState } from 'react'
import { BookOpenCheck, ChevronRight, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const cleanLabel = (element, fallback='Control') => (element?.getAttribute('aria-label') || element?.getAttribute('placeholder') || element?.getAttribute('title') || element?.textContent || fallback).trim().replace(/\s+/g,' ').slice(0,90)

function instructionFor(element, label) {
  if (element.matches('[data-guide-current-nav]')) return `Ito ang active menu na “${label}”. Pindutin ito para bumalik sa page na ito.`
  if (element.matches('h1,h2')) return `Ito ang “${label}” section. Basahin muna ang page bago gumamit ng action.`
  if (element.matches('select')) return `Pindutin ang “${label}” at piliin ang tamang option sa dropdown.`
  if (element.matches('textarea')) return `I-type sa “${label}” ang kumpleto at tamang impormasyon.`
  if (element.matches('input[type="checkbox"],input[type="radio"]')) return `Piliin ang “${label}” kung naaangkop sa gagawin mo.`
  if (element.matches('input')) return `Ilagay ang tamang ${label.toLowerCase()} dito, pagkatapos ay i-check bago mag-save.`
  if (element.matches('a')) return `Pindutin ang “${label}” para buksan ang susunod na page o action.`
  return `Pindutin ang “${label}” para gawin ang action na ito.`
}

export default function InteractivePageGuide() {
  const { pathname }=useLocation()
  const [open,setOpen]=useState(false)
  const [index,setIndex]=useState(0)
  const [tour,setTour]=useState([])
  const [position,setPosition]=useState({})

  const collect = () => {
    const main=document.querySelector('[data-guide-main]')
    const visible=element=>element&&element.offsetParent!==null&&!element.disabled&&!element.closest('[data-guide-walkthrough]')
    const elements=[]
    const nav=document.querySelector('[data-guide-current-nav]');if(visible(nav))elements.push(nav)
    const heading=main?.querySelector('h1')||main?.querySelector('h2');if(visible(heading))elements.push(heading)
    main?.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea').forEach(element=>{if(visible(element)&&elements.length<22)elements.push(element)})
    const bell=document.querySelector('[data-guide-notifications] button');if(visible(bell))elements.push(bell)
    return [...new Set(elements)].map((element,step)=>{const label=cleanLabel(element,`Control ${step+1}`);return{element,label,instruction:instructionFor(element,label)}})
  }

  const start=()=>{const controls=collect();setTour(controls);setIndex(0);setOpen(true)}
  useEffect(()=>{if(open){setTour(collect());setIndex(0)}},[pathname])

  useEffect(()=>{
    const target=tour[index]?.element
    if(!open||!target||!document.contains(target))return
    const old={outline:target.style.outline,outlineOffset:target.style.outlineOffset,boxShadow:target.style.boxShadow,position:target.style.position,zIndex:target.style.zIndex,borderRadius:target.style.borderRadius}
    target.style.outline='4px solid #FFB238';target.style.outlineOffset='6px';target.style.boxShadow='0 0 0 9999px rgba(3,33,22,.44),0 0 0 12px rgba(255,178,56,.25),0 20px 50px rgba(3,33,22,.35)'
    if(getComputedStyle(target).position==='static')target.style.position='relative';target.style.zIndex='88';target.style.borderRadius=target.style.borderRadius||'12px'
    target.scrollIntoView({behavior:'smooth',block:'center',inline:'center'})
    if(target.matches('input,select,textarea'))setTimeout(()=>target.focus({preventScroll:true}),350)
    const place=()=>{if(window.innerWidth<640){setPosition({});return}const rect=target.getBoundingClientRect(),width=384,gap=18;let left=Math.min(window.innerWidth-width-18,Math.max(18,rect.left));let top=rect.bottom+gap;if(top+315>window.innerHeight)top=Math.max(18,rect.top-315-gap);setPosition({left:`${left}px`,top:`${top}px`,right:'auto',bottom:'auto'})}
    const timer=setTimeout(place,380);window.addEventListener('resize',place);window.addEventListener('scroll',place,true)
    return()=>{clearTimeout(timer);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);Object.assign(target.style,old)}
  },[open,index,tour])

  const current=tour[index]
  const next=()=>index>=tour.length-1?setOpen(false):setIndex(value=>value+1)
  return <>
    <button type="button" onClick={start} className="flex h-10 items-center gap-2 rounded-xl border border-black/[.06] bg-white px-3 text-sm font-bold text-teal-700 shadow-sm transition hover:bg-teal-50" aria-label="Open button-by-button guide"><BookOpenCheck size={18}/><span className="hidden sm:inline">Guide</span></button>
    {open&&current&&<div data-guide-walkthrough style={position} className="fixed inset-x-2 bottom-2 z-[100] mx-auto max-h-[48vh] w-auto max-w-md overflow-y-auto rounded-[1.5rem] border border-mango-300/50 bg-white shadow-2xl sm:inset-x-auto sm:max-h-[420px] sm:w-96" role="dialog" aria-labelledby="interactive-guide-title"><header className="sticky top-0 z-10 bg-gradient-to-br from-teal-950 via-teal-800 to-teal-700 px-4 py-3.5 text-white"><button onClick={()=>setOpen(false)} className="absolute right-3 top-3 rounded-xl bg-white/10 p-2 hover:bg-white/20" aria-label="Close guide"><X size={17}/></button><p className="text-[9px] font-extrabold uppercase tracking-[.17em] text-mango-300">Button-by-button tour · {index+1}/{tour.length}</p><h2 id="interactive-guide-title" className="mt-1 pr-10 font-display text-base font-bold">{cleanLabel(document.querySelector('[data-guide-main] h1')||document.querySelector('[data-guide-main] h2'),'Page guide')}</h2></header><div className="p-3.5"><div className="mb-3 flex gap-1 overflow-hidden">{tour.map((_,step)=><span key={step} className={`h-1.5 min-w-1.5 flex-1 rounded-full ${step<=index?'bg-teal-600':'bg-black/10'}`}/>)}</div><div className="rounded-2xl border border-mango-200 bg-gradient-to-br from-mango-100/80 to-white p-3.5"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mango-500 text-xs font-extrabold text-ink">{index+1}</span><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-wide text-teal-700">Selected control</p><p className="break-words text-sm font-bold text-ink">{current.label}</p><p className="mt-1.5 text-xs leading-5 text-ink/65">{current.instruction}</p></div></div></div><p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-[10px] leading-4 text-teal-900"><strong>Tip:</strong> Puwede mong pindutin ang naka-highlight na control habang bukas ang guide, pagkatapos ay gamitin ang Next button.</p><div className="mt-3 flex gap-2">{index>0&&<button onClick={()=>setIndex(value=>value-1)} className="btn-secondary flex-1 py-2 text-xs">Back</button>}<button onClick={next} className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2 text-xs">{index===tour.length-1?'Finish':'Next button'}{index<tour.length-1&&<ChevronRight size={15}/>}</button></div><button onClick={()=>setOpen(false)} className="mt-2 w-full py-1 text-[10px] font-bold text-ink/40 hover:text-ink">Exit walkthrough</button></div></div>}
  </>
}
