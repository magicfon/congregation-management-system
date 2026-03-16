'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const navItems = [
  {
    href: '/dashboard',
    label: '儀表板',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/areas',
    label: '區域管理',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: '/members',
    label: '成員管理',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: '/schedules',
    label: '排班系統',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/reports',
    label: '回報系統',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/statistics',
    label: '統計報表',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

type Props = {
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: Props) {
  const pathname = usePathname()

  return (
    <aside
      className={`
        fixed left-0 top-0 h-full bg-mc-card border-r border-white/5 flex flex-col z-30
        overflow-hidden
        transition-[width,transform] duration-200 ease-in-out
        w-64
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        ${collapsed ? 'md:w-16' : 'md:w-64'}
      `}
    >
      {/* Brand */}
      <div className="border-b border-white/5 flex items-center h-[57px] flex-shrink-0">
        {/* Icon — always visible, centered when collapsed */}
        <div className={`flex items-center gap-3 transition-[padding] duration-200 ${collapsed ? 'md:px-0 md:justify-center md:w-full px-5' : 'px-5 flex-1'}`}>
          <div className="w-8 h-8 rounded-lg bg-mc-highlight border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          {/* Text — hidden when desktop collapsed */}
          <div className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${collapsed ? 'md:max-w-0 md:opacity-0' : 'max-w-xs opacity-100'}`}>
            <div className="text-sm font-semibold text-mc-text leading-tight">會眾管理系統</div>
            <div className="text-xs text-mc-text/40">Mission Control</div>
          </div>
        </div>

        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden mr-3 flex-shrink-0 p-1.5 rounded-lg text-mc-text/40 hover:text-mc-text hover:bg-mc-accent transition-colors"
          aria-label="關閉選單"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg text-sm transition-all duration-150 ${
                active
                  ? 'bg-mc-highlight text-white border border-blue-500/30'
                  : 'text-mc-text/60 hover:text-mc-text hover:bg-mc-accent'
              } ${collapsed ? 'md:justify-center md:px-0 md:py-2.5 gap-3 px-3 py-3' : 'gap-3 px-3 py-3 md:py-2.5'}`}
            >
              <span className={`flex-shrink-0 ${active ? 'text-blue-400' : ''}`}>{item.icon}</span>
              <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${collapsed ? 'md:max-w-0 md:opacity-0' : 'max-w-xs opacity-100'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Desktop collapse toggle */}
      <div className="hidden md:block px-2 py-2 border-t border-white/5">
        <button
          onClick={onToggleCollapse}
          title={collapsed ? '展開側邊欄' : '收起側邊欄'}
          className={`w-full flex items-center rounded-lg py-2.5 text-mc-text/40 hover:text-mc-text hover:bg-mc-accent transition-colors ${
            collapsed ? 'justify-center px-0' : 'gap-3 px-3'
          }`}
        >
          <svg
            className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          <span className={`text-sm overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${collapsed ? 'max-w-0 opacity-0' : 'max-w-xs opacity-100'}`}>
            收起側邊欄
          </span>
        </button>
      </div>

      {/* Footer — logout */}
      <div className="px-2 pb-3 pt-1">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={collapsed ? '登出' : undefined}
          className={`w-full flex items-center rounded-lg py-3 md:py-2.5 text-sm text-mc-text/50 hover:text-mc-error hover:bg-mc-error/10 transition-all ${
            collapsed ? 'md:justify-center md:px-0 gap-3 px-3' : 'gap-3 px-3'
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${collapsed ? 'md:max-w-0 md:opacity-0' : 'max-w-xs opacity-100'}`}>
            登出
          </span>
        </button>
      </div>
    </aside>
  )
}
