'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './Sidebar'
import Link from 'next/link'
import { type CurrentUserState } from './CurrentUser'

export default function DashboardLayout({ children, publicView = false }: { children: React.ReactNode; publicView?: boolean }) {
  if (publicView) return (
    <div className="min-h-screen bg-mc-bg text-mc-text">
      <header className="border-b border-white/10 bg-mc-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link href="/bulletin" className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300">▤</span>
            <span className="text-sm font-semibold sm:text-base">楠梓會眾<span className="block text-xs font-normal text-mc-text/50">公布欄</span></span>
          </Link>
          <Link href="/login" className="flex min-h-11 items-center rounded-lg border border-white/10 px-4 text-sm text-mc-text/70 hover:bg-mc-accent">成員登入</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs text-mc-text/50 md:px-8">楠梓會眾公布欄 · 聚會與傳道資訊</footer>
    </div>
  )
  return <MemberDashboardLayout>{children}</MemberDashboardLayout>
}

function MemberDashboardLayout({ children }: { children: React.ReactNode }) {
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
    </div>
  )
}
