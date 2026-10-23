'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react'

type Theme = 'system' | 'light' | 'dark'
const storageKey = 'bulletin-theme'
const choices = [
  { value: 'light', label: '淺色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
  { value: 'system', label: '跟隨裝置', Icon: Monitor },
] as const
const parseTheme = (value: string | null): Theme => value === 'light' || value === 'dark' ? value : 'system'

const AppearanceContext = createContext<{
  theme: Theme
  deviceTheme: 'light' | 'dark'
  setTheme: (value: Theme) => void
} | null>(null)

export default function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')
  const [deviceTheme, setDeviceTheme] = useState<'light' | 'dark'>('dark')
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncDevice = () => setDeviceTheme(media.matches ? 'dark' : 'light')
    syncDevice()
    media.addEventListener('change', syncDevice)
    return () => media.removeEventListener('change', syncDevice)
  }, [])
  useEffect(() => {
    try { setTheme(parseTheme(localStorage.getItem(storageKey))) } catch { /* Follow device without storage. */ }
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setTheme(parseTheme(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => {
    // Tokens live on <html> so the head script and React share one source.
    document.documentElement.dataset.bulletinTheme = theme
  }, [theme])
  const pathname = usePathname()
  const integratedHeader = pathname.startsWith('/bulletin') || ['/service-roster/manage', '/map-images', '/boundary-editor', '/pending-access'].includes(pathname)
  return <AppearanceContext.Provider value={{ theme, deviceTheme, setTheme }}>
    <div className={`appearance-shell min-h-screen bg-mc-bg text-mc-text ${integratedHeader ? '' : 'pt-14'}`}>
      {!integratedHeader && <>
        <div className="appearance-toolbar fixed inset-x-0 top-0 z-20 h-14 border-b border-white/10 bg-mc-card" />
        <AppearanceControl />
      </>}
      {children}
    </div>
  </AppearanceContext.Provider>
}

export function AppearanceControl({ inline = false }: { inline?: boolean }) {
  const appearance = useContext(AppearanceContext)
  const [open, setOpen] = useState(false)
  const control = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
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
  if (!appearance) return null
  const { theme, deviceTheme, setTheme } = appearance
  const selected = choices.find(choice => choice.value === theme)!
  const SelectedIcon = selected.Icon
  const currentLabel = (theme === 'system' ? deviceTheme : theme) === 'dark' ? '深色' : '淺色'

  return (
    <div ref={control} className={inline ? 'appearance-toolbar relative shrink-0' : 'appearance-toolbar fixed right-3 top-1.5 z-40 md:right-8'} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
    }}>
      <button ref={trigger} type="button" aria-label={theme === 'system' ? `${currentLabel}，跟隨裝置` : currentLabel} aria-expanded={open} aria-controls="appearance-options" onClick={() => setOpen(value => !value)} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
        <SelectedIcon size={18} aria-hidden="true" /><span className={inline ? 'hidden sm:inline' : undefined}>{currentLabel}</span><ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && <fieldset id="appearance-options" className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-mc-card p-2 shadow-xl shadow-black/20 outline outline-1 outline-mc-text/15">
        <legend className="sr-only">選擇外觀</legend>
        {choices.map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => {
          setTheme(value)
          try { localStorage.setItem(storageKey, value) } catch { /* Keep this visit usable. */ }
          setOpen(false)
          trigger.current?.focus()
        }} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${theme === value ? 'bg-mc-accent font-medium' : ''}`}>
          <Icon size={18} aria-hidden="true" /><span className="flex-1 text-left">{label}{value === 'system' && <span className="block text-xs text-mc-text/70">目前{deviceTheme === 'dark' ? '深色' : '淺色'}</span>}</span>{theme === value && <Check size={16} className="ml-auto" aria-hidden="true" />}
        </button>)}
      </fieldset>}
    </div>
  )
}
