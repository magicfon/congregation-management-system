'use client'

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import Sidebar from './Sidebar'
import BulletinLayout from '@/components/bulletin/BulletinLayout'
import { type CurrentUserState } from './CurrentUser'

type Theme = 'system' | 'light' | 'dark'
const AppearanceContext = createContext<{ theme: Theme; chooseTheme: (value: Theme) => void } | null>(null)

export function DashboardAppearance() {
  const appearance = useContext(AppearanceContext)
  if (!appearance) return null
  return <fieldset className="flex shrink-0 gap-1" aria-label="看板外觀">
    {([{ value: 'system', label: '跟隨裝置', Icon: Monitor }, { value: 'light', label: '淺色', Icon: Sun }, { value: 'dark', label: '深色', Icon: Moon }] as const).map(({ value, label, Icon }) => <button key={value} type="button" aria-label={label} title={label} aria-pressed={appearance.theme === value} onClick={() => appearance.chooseTheme(value)} className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-current ${appearance.theme === value ? 'bg-mc-accent text-mc-text' : 'text-mc-text/70 hover:bg-mc-accent'}`}><Icon size={16} aria-hidden="true" /><span className="hidden sm:inline">{label}</span></button>)}
  </fieldset>
}

export default function DashboardLayout({ children, publicView = false, appearance = false }: { children: React.ReactNode; publicView?: boolean; appearance?: boolean }) {
  if (publicView) return <BulletinLayout>{children}</BulletinLayout>
  return <MemberDashboardLayout appearance={appearance}>{children}</MemberDashboardLayout>
}

function MemberDashboardLayout({ children, appearance }: { children: React.ReactNode; appearance: boolean }) {
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => {
    const read = () => {
      try {
        const saved = localStorage.getItem('bulletin-theme')
        setTheme(saved === 'light' || saved === 'dark' ? saved : 'system')
      } catch { /* Storage may be unavailable in private browsers. */ }
    }
    read()
    window.addEventListener('storage', read)
    return () => window.removeEventListener('storage', read)
  }, [])
  function chooseTheme(value: Theme) {
    setTheme(value)
    try { localStorage.setItem('bulletin-theme', value) } catch { /* Keep the current session usable. */ }
  }
  const [mobileOpen, setMobileOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUserState>({ status: 'loading' })
  const userRequest = useRef<AbortController | null>(null)
  const refreshUser = useCallback(async () => {
    userRequest.current?.abort()
    const controller = new AbortController()
    userRequest.current = controller
    try {
      const res = await fetch('/api/me', { cache: 'no-store', signal: controller.signal })
      if (res.status === 401) { setCurrentUser({ status: 'signed-out' }); return }
      if (!res.ok) throw new Error('Unable to load current user')
      const user = await res.json()
      if (!controller.signal.aborted) setCurrentUser({ status: 'ready', name: user.name, role: user.role })
    } catch {
      if (!controller.signal.aborted) setCurrentUser({ status: 'error' })
    }
  }, [])
  useEffect(() => {
    void refreshUser()
    const onFocus = () => { void refreshUser() }
    window.addEventListener('focus', onFocus)
    return () => { userRequest.current?.abort(); window.removeEventListener('focus', onFocus) }
  }, [refreshUser])

  // Desktop collapse — persisted to localStorage
  // Start with false on both server and client to avoid hydration mismatch,
  // then read localStorage after hydration via useEffect.
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)

  useEffect(() => {
    setDesktopCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
  }, [])

  function toggleCollapse() {
    setDesktopCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <AppearanceContext.Provider value={{ theme, chooseTheme }}><div data-bulletin-theme={theme} className={`min-h-screen bg-mc-bg text-mc-text ${appearance ? 'bulletin-theme dashboard-theme' : ''}`}>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-mc-card border-b border-white/5 flex items-center gap-3 px-4 z-20">
        <button
          onClick={() => setMobileOpen(true)}
          className="shrink-0 p-2 rounded-lg text-mc-text/60 hover:text-mc-text hover:bg-mc-accent transition-colors"
          aria-label="開啟選單"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="shrink-0 text-sm font-semibold text-mc-text">地圖分配</span>
      </header>

      {/* Backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-20"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        currentUser={currentUser}
        onRetryUser={() => void refreshUser()}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={desktopCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main — shifts right when desktop sidebar expands/collapses */}
      <main
        className={`pt-14 md:pt-0 min-h-screen overflow-auto transition-[margin] duration-200 ease-in-out ${
          desktopCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        {children}
      </main>
    </div></AppearanceContext.Provider>
  )
}
