'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, LayoutDashboard, LogIn, Menu, RotateCw, X } from 'lucide-react'
import { bulletinCategories } from '@/lib/bulletin'
import BulletinIcon from '@/components/bulletin/BulletinIcon'

type Account = { state: 'loading' } | { state: 'error'; retry: () => void } | { state: 'guest'; loginHref: string } | { state: 'member' }

// 公布欄主選單：標頭右上 ☰，由右側滑出；含我的看板／登入與七個分類（ADR-0066～0068）。
export default function BulletinMenu({ current, account }: { current?: string; account: Account }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const dismiss = useRef(() => {})
  dismiss.current = () => {
    if (closing) return
    trigger.current?.focus()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setOpen(false); return }
    setClosing(true)
    window.setTimeout(() => { setOpen(false); setClosing(false) }, 180)
  }
  useEffect(() => {
    if (!open) return
    close.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss.current() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open])

  const row = 'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-base hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400'
  return <>
    <button ref={trigger} type="button" aria-label="主選單" aria-expanded={open && !closing} aria-controls="bulletin-menu" onClick={() => setOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-mc-text/70 hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
      <Menu aria-hidden="true" className="h-5 w-5" />
    </button>
    {open && <>
      <div aria-hidden="true" onClick={() => dismiss.current()} className={`fixed inset-0 z-40 bg-black/50 ${closing ? 'backdrop-out' : 'backdrop-in'}`} />
      <nav id="bulletin-menu" aria-label="主選單" className={`${closing ? 'drawer-out' : 'drawer-in'} fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-mc-card p-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-mc-text shadow-xl shadow-black/30 outline outline-1 outline-mc-text/15`}>
        <div className="mb-1 flex justify-end">
          <button ref={close} type="button" aria-label="關閉選單" onClick={() => dismiss.current()} className="flex h-11 w-11 items-center justify-center rounded-lg text-mc-text/70 hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {account.state === 'member' && <Link href="/dashboard" className={`${row} font-medium`}><LayoutDashboard aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-300" />我的看板</Link>}
        {account.state === 'guest' && <Link href={account.loginHref} className={`${row} font-medium`}><LogIn aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-300" />登入</Link>}
        {account.state === 'error' && <button type="button" onClick={account.retry} className={row}><RotateCw aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-300" />重試登入狀態</button>}
        <p className="mb-1 mt-4 px-3 text-xs font-semibold text-mc-text/60">公布欄分類</p>
        {bulletinCategories.map(item => {
          const active = item.slug === current
          return <Link key={item.slug} href={`/bulletin/${item.slug}`} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)} className={`${row} ${active ? 'bg-mc-accent font-medium' : ''}`}>
            <BulletinIcon icon={item.icon} className="h-5 w-5 shrink-0 text-blue-300" />
            <span className="flex-1">{item.title}</span>
            {active && <Check aria-hidden="true" className="h-4 w-4" />}
          </Link>
        })}
      </nav>
    </>}
  </>
}
