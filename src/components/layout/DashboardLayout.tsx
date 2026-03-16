'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

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
          className="p-2 rounded-lg text-mc-text/60 hover:text-mc-text hover:bg-mc-accent transition-colors"
          aria-label="開啟選單"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-mc-highlight border border-blue-500/30 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-mc-text">會眾管理系統</span>
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
        {children}
      </main>
    </div>
  )
}
