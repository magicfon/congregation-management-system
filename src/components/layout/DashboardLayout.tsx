'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './Sidebar'
import CurrentUser, { type CurrentUserState } from './CurrentUser'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen bg-mc-bg">
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
        <div className="ml-auto min-w-0">
          <CurrentUser state={currentUser} onRetry={() => void refreshUser()} />
        </div>
      </header>

      {/* Backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-20"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
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
        <div className="hidden md:flex h-10 items-center justify-end border-b border-white/5 px-4 md:px-8">
          <div className="max-w-sm min-w-0">
            <CurrentUser state={currentUser} onRetry={() => void refreshUser()} />
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
