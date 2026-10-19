'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
export default function BulletinLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const meetingReader = pathname === '/bulletin/midweek-meeting'
  const compact = (pathname === '/bulletin/service-roster' || pathname.startsWith('/bulletin/service-roster/')) || pathname === '/service-roster/manage'
  const [user, setUser] = useState<{ role: string } | null>()
  const [authError, setAuthError] = useState(false)
  const [authRetry, setAuthRetry] = useState(0)
  useEffect(() => {
    let request: AbortController | undefined
    async function refresh() {
      request?.abort()
      const controller = new AbortController()
      request = controller
      setAuthError(false)
      try {
        const response = await fetch('/api/me', { cache: 'no-store', signal: controller.signal })
        if (!response.ok && response.status !== 401) throw new Error('Unable to check session')
        const identity = response.ok ? await response.json() : null
        if (!controller.signal.aborted) setUser(identity?.id ? { role: identity.role } : null)
      } catch {
        if (!controller.signal.aborted) setAuthError(true)
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      request?.abort()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pathname, authRetry])
  return <div className="min-h-[calc(100dvh-3.5rem)] bg-mc-bg text-mc-text">
    {!meetingReader && <header className="border-b border-white/10 bg-mc-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
        <Link href="/bulletin" className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300">▤</span>
          <span className="text-sm font-semibold sm:text-base">楠梓會眾<span className="block text-xs font-normal text-mc-text/50">公布欄</span></span>
        </Link>
        {authError ? <button type="button" onClick={() => setAuthRetry(value => value + 1)} className="min-h-11 rounded-lg border border-white/10 px-3 text-sm">重試登入狀態</button> : user !== undefined && <Link href={user ? compact && user.role === 'admin' ? '/service-roster/manage' : '/dashboard' : `/login?callbackUrl=${encodeURIComponent(pathname)}`} className="flex min-h-11 items-center rounded-lg border border-white/10 px-4 text-sm text-mc-text/70 hover:bg-mc-accent">{user ? compact && user.role === 'admin' ? '管理安排' : '我的帳號' : '登入'}</Link>}
      </div>
    </header>}
    <main className={meetingReader ? 'mx-auto max-w-6xl px-3 py-2 md:px-8 md:py-3' : 'mx-auto max-w-6xl p-4 md:p-8'}>{children}</main>
  </div>
}
