'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, PanelsTopLeft } from 'lucide-react'
import { bulletinCategories } from '@/lib/bulletin'
import { AppearanceControl } from '@/components/layout/AppearanceProvider'
import BulletinMenu from '@/components/bulletin/BulletinMenu'
export default function BulletinLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // 週中聚會閱讀頁沿用同一標頭，內容區留白較緊湊（ADR-0070）。
  const meetingReader = pathname === '/bulletin/midweek-meeting'
  // 分類頁把返回與標題併入標頭，省去獨立標題列（ADR-0069）。
  const category = /^\/bulletin\/[^/]+$/.test(pathname) ? bulletinCategories.find(item => pathname === `/bulletin/${item.slug}`) : undefined
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
  return <div className="min-h-screen bg-mc-bg text-mc-text">
    <header className="relative z-30 border-b border-white/10 bg-mc-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 md:gap-4 md:px-8">
        {category ? <div className="flex min-w-0 items-center gap-2">
          <Link href="/bulletin" aria-label="回公布欄" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-mc-text/70 hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"><ArrowLeft aria-hidden="true" className="h-5 w-5" /></Link>
          <h1 className="truncate text-lg font-semibold">{category.title}</h1>
        </div> : <Link href="/bulletin" className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
          <span aria-hidden="true" className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300 sm:flex"><PanelsTopLeft size={22} /></span>
          <span className="text-sm font-semibold sm:text-base">楠梓會眾<span className="block text-xs font-normal text-mc-text/50">公布欄</span></span>
        </Link>}
        <div className="flex shrink-0 items-center gap-1 sm:gap-3"><AppearanceControl inline />
        <BulletinMenu current={pathname.split('/')[2]} account={authError ? { state: 'error', retry: () => setAuthRetry(value => value + 1) } : user === undefined ? { state: 'loading' } : user ? { state: 'member' } : { state: 'guest', loginHref: `/login?callbackUrl=${encodeURIComponent(pathname)}` }} />
        </div>
      </div>
    </header>
    <main className={meetingReader ? 'mx-auto max-w-6xl px-3 py-2 md:px-8 md:py-3' : 'mx-auto max-w-6xl p-4 md:p-8'}>{children}</main>
  </div>
}
