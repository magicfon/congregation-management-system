'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown } from 'lucide-react'
import { bulletinCategories } from '@/lib/bulletin'
import BulletinIcon from '@/components/bulletin/BulletinIcon'

// 標題即切換器：手機由底部滑出清單，桌面為標題下方浮窗（ADR-0065）。
export default function CategorySwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false)
  const control = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const category = bulletinCategories.find(item => item.slug === current)!
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!control.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return <div ref={control} className="relative min-w-0 flex-1">
    <h1 className="text-xl font-semibold"><button ref={trigger} type="button" aria-expanded={open} aria-controls="bulletin-categories" onClick={() => setOpen(value => !value)} className="-mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
      <span>{category.title}</span>
      <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-mc-text/60 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      <span className="sr-only">，切換分類</span>
    </button></h1>
    {open && <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/50 sm:hidden" />
      <nav id="bulletin-categories" aria-label="公布欄分類" className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-mc-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl shadow-black/30 outline outline-1 outline-mc-text/15 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-64 sm:rounded-xl sm:pb-2">
        <div aria-hidden="true" className="mx-auto mb-2 mt-1 h-1 w-10 rounded-full bg-mc-text/20 sm:hidden" />
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
  </div>
}
