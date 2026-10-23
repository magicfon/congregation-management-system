'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Menu, X } from 'lucide-react'
import { bulletinCategories } from '@/lib/bulletin'
import BulletinIcon from '@/components/bulletin/BulletinIcon'

// 標題維持純文字，分類收在右側漢堡選單，由側邊滑出（ADR-0066、ADR-0067 動畫）。
export default function CategoryMenu({ current }: { current: string }) {
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

  return <>
    <button ref={trigger} type="button" aria-label="公布欄分類" aria-expanded={open && !closing} aria-controls="bulletin-categories" onClick={() => setOpen(true)} className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-mc-text/70 hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
      <Menu aria-hidden="true" className="h-5 w-5" />
    </button>
    {open && <>
      <div aria-hidden="true" onClick={() => dismiss.current()} className={`fixed inset-0 z-40 bg-black/50 ${closing ? 'backdrop-out' : 'backdrop-in'}`} />
      <nav id="bulletin-categories" aria-label="公布欄分類" className={`${closing ? 'drawer-out' : 'drawer-in'} fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col bg-mc-card p-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-xl shadow-black/30 outline outline-1 outline-mc-text/15`}>
        <div className="mb-2 flex items-center justify-between pl-3">
          <span className="text-sm font-semibold text-mc-text/70">分類</span>
          <button ref={close} type="button" aria-label="關閉分類" onClick={() => dismiss.current()} className="flex h-11 w-11 items-center justify-center rounded-lg text-mc-text/70 hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {bulletinCategories.map(item => {
          const active = item.slug === current
          return <Link key={item.slug} href={`/bulletin/${item.slug}`} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)} className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-base hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${active ? 'bg-mc-accent font-medium' : ''}`}>
            <BulletinIcon icon={item.icon} className="h-5 w-5 shrink-0 text-blue-300" />
            <span className="flex-1">{item.title}</span>
            {active && <Check aria-hidden="true" className="h-4 w-4" />}
          </Link>
        })}
      </nav>
    </>}
  </>
}
