'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Monitor, Moon, Sun } from 'lucide-react'

type Theme = 'system' | 'light' | 'dark'
const storageKey = 'bulletin-theme'
const choices = [
  { value: 'system', label: '依裝置', Icon: Monitor },
  { value: 'light', label: '亮色', Icon: Sun },
  { value: 'dark', label: '暗色', Icon: Moon },
] as const
function parseTheme(value: string | null): Theme { return value === 'light' || value === 'dark' ? value : 'system' }

export default function BulletinLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const compact = (pathname === '/bulletin/service-roster' || pathname.startsWith('/bulletin/service-roster/')) || pathname === '/service-roster/manage'
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => {
    try { setTheme(parseTheme(localStorage.getItem(storageKey))) } catch { /* Device preference works without storage. */ }
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) setTheme(parseTheme(event.newValue)) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function chooseTheme(value: Theme) {
    setTheme(value)
    try { localStorage.setItem(storageKey, value) } catch { /* Keep the selection for this visit. */ }
  }

  return <div data-bulletin-theme={theme} className="bulletin-theme min-h-screen bg-mc-bg text-mc-text">
    <header className="border-b border-white/10 bg-mc-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
        <Link href="/bulletin" className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300">▤</span>
          <span className="text-sm font-semibold sm:text-base">楠梓會眾<span className="block text-xs font-normal text-mc-text/50">公布欄</span></span>
        </Link>
        <fieldset className={compact ? 'ml-auto flex items-center gap-0.5 rounded-xl bg-mc-bg p-1' : 'order-last flex w-full items-center justify-end gap-1 rounded-xl bg-mc-bg p-1 sm:order-none sm:ml-auto sm:w-auto'}>
          <legend className="sr-only">公布欄外觀</legend>
          {choices.map(({ value, label, Icon }) => <button key={value} type="button" aria-label={label} title={label} aria-pressed={theme === value} onClick={() => chooseTheme(value)} className={`flex min-h-11 items-center gap-2 rounded-lg ${compact ? 'justify-center px-2 sm:px-3' : 'px-3'} text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${theme === value ? 'bg-mc-accent text-mc-text' : 'text-mc-text/60 hover:bg-mc-accent'}`}><Icon aria-hidden="true" className="h-4 w-4" /><span className={compact ? 'hidden sm:inline' : ''}>{label}</span></button>)}
        </fieldset>
        <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`} className="flex min-h-11 items-center rounded-lg border border-white/10 px-4 text-sm text-mc-text/70 hover:bg-mc-accent">登入</Link>
      </div>
    </header>
    <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
  </div>
}
