'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react'

type Theme = 'system' | 'light' | 'dark'
const storageKey = 'bulletin-theme'
const choices = [
  { value: 'light', label: '淺色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
  { value: 'system', label: '跟隨裝置', Icon: Monitor },
] as const
const parseTheme = (value: string | null): Theme => value === 'light' || value === 'dark' ? value : 'system'

export default function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')
  const [open, setOpen] = useState(false)
  const control = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    try { setTheme(parseTheme(localStorage.getItem(storageKey))) } catch { /* Follow device without storage. */ }
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setTheme(parseTheme(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => {
    // Put tokens on body as well so portaled controls share the same appearance.
    document.body.classList.add('bulletin-theme', 'dashboard-theme')
    document.body.dataset.bulletinTheme = theme
  }, [theme])
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
  const SelectedIcon = choices.find(choice => choice.value === theme)!.Icon

  return <div data-bulletin-theme={theme} className="appearance-shell bulletin-theme dashboard-theme min-h-screen bg-mc-bg pt-14 text-mc-text">
    <div className="appearance-toolbar fixed inset-x-0 top-0 z-20 h-14 border-b border-white/10 bg-mc-card" />
    <div ref={control} className="appearance-toolbar fixed right-3 top-1.5 z-40 md:right-8" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
    }}>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls="appearance-options" onClick={() => setOpen(value => !value)} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
        <SelectedIcon size={18} aria-hidden="true" /><span>外觀</span><ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && <fieldset id="appearance-options" className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-mc-card p-2 shadow-xl shadow-black/20 outline outline-1 outline-mc-text/15">
        <legend className="sr-only">選擇外觀</legend>
        {choices.map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => {
          setTheme(value)
          try { localStorage.setItem(storageKey, value) } catch { /* Keep this visit usable. */ }
          setOpen(false)
          trigger.current?.focus()
        }} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${theme === value ? 'bg-mc-accent font-medium' : ''}`}>
          <Icon size={18} aria-hidden="true" /><span>{label}</span>{theme === value && <Check size={16} className="ml-auto" aria-hidden="true" />}
        </button>)}
      </fieldset>}
    </div>
    {children}
  </div>
}
