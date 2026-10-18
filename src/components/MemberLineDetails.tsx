'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type MemberDetails = { name: string; email: string; phone: string | null; lineuid?: string | null; lineDisplayName?: string | null }

export default function MemberLineDetails({ member }: { member: MemberDetails }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const trigger = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const id = useId()
  const cancelClose = () => clearTimeout(timer.current)
  const show = () => { cancelClose(); setOpen(true) }
  const closeSoon = () => { cancelClose(); timer.current = setTimeout(() => setOpen(false), 150) }

  useEffect(() => () => clearTimeout(timer.current), [])
  useLayoutEffect(() => {
    if (!open || !trigger.current || !card.current) return
    const anchor = trigger.current.getBoundingClientRect()
    const bounds = card.current.getBoundingClientRect()
    const top = anchor.bottom + 8 + bounds.height <= window.innerHeight - 12
      ? anchor.bottom + 8 : Math.max(12, anchor.top - bounds.height - 8)
    setPosition({ left: Math.max(12, Math.min(anchor.left, window.innerWidth - bounds.width - 12)), top })
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !card.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const close = (event: Event) => { if (!card.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return <>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={open ? id : undefined}
      aria-label={`${member.name}的 LINE 與聯絡詳細資訊`}
      onMouseEnter={show} onMouseLeave={closeSoon} onFocus={show}
      onBlur={event => { if (!card.current?.contains(event.relatedTarget as Node)) closeSoon() }} onClick={show}
      className="min-h-11 max-w-full break-words text-left text-xs text-mc-text/60 hover:text-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
      {member.lineuid ? member.lineDisplayName || '已綁定 LINE（名稱待更新）' : '未綁定 LINE'}
    </button>
    {open && createPortal(<div ref={card} id={id} role="region" aria-label={`${member.name}的詳細資訊`}
      onMouseEnter={cancelClose} onMouseLeave={closeSoon} onFocus={cancelClose}
      onBlur={event => { if (!card.current?.contains(event.relatedTarget as Node)) closeSoon() }}
      style={position} className="fixed z-[100] w-80 max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl border border-white/15 bg-mc-card p-4 text-mc-text shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{member.name}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="關閉詳細資訊" className="min-h-8 min-w-8 rounded text-mc-text/60 hover:bg-white/10">×</button>
      </div>
      <dl className="space-y-3 text-xs">
        {[['LINE 名稱', member.lineDisplayName || (member.lineuid ? '待下次登入更新' : '未綁定 LINE')], ['UID', member.lineuid || '未綁定'], ['電話', member.phone || '未設定']].map(([label, value]) => <div key={label}>
          <dt className="mb-1 text-mc-text/40">{label}</dt>
          <dd className={`break-all select-text ${label === 'UID' ? 'font-mono' : ''}`}>{value}</dd>
        </div>)}
      </dl>
    </div>, document.body)}
  </>
}
