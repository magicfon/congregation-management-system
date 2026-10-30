'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { currentAndFutureWeeks, nextMidweekCheck } from '@/lib/midweek'
import type { Palette } from '@/lib/midweek-versions'
import MidweekWeek, { type ManagedWeek } from './MidweekWeek'

type Sync = { month: string; remaining: number; done: number; imported: number; completedAt: string | null; errors: { url: string; error: string }[]; busy?: boolean }
const button = 'min-h-11 rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40'
const endpoint = '/api/midweek/manage'
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...options })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '讀取失敗')
  return data
}
// 週中編排頁：本週起連續列出各週，捲到底才載入下一週；寬螢幕兩週左右並排（ADR-0099）。
export default function MidweekManager() {
  const [weeks, setWeeks] = useState<ManagedWeek[]>([])
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [sync, setSync] = useState<Sync | null>(null), [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [palette, setPalette] = useState<Palette>({})
  const [count, setCount] = useState(1), [loaded, setLoaded] = useState<string[]>([])
  const [atEnd, setAtEnd] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null), grid = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => {
    let active = true
    const refreshColors = () => { if (document.visibilityState === 'visible') api('/api/midweek?palette=1').then(data=>{if(active)setPalette(data.palette)}).catch(()=>{}) }
    refreshColors()
    window.addEventListener('focus', refreshColors)
    const timer = window.setInterval(refreshColors, 30000)
    return () => { active=false; window.removeEventListener('focus',refreshColors); window.clearInterval(timer) }
  }, [])
  async function refresh() {
    const data = await api(endpoint)
    if (!alive.current) return
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    setWeeks(currentAndFutureWeeks(data.weeks, today)); setMembers(data.members); setSync(data.sync)
  }
  useEffect(() => {
    alive.current = true
    refresh().catch(e => setError(e.message)).finally(() => setLoading(false))
    return () => { alive.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const target = sentinel.current
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => setAtEnd(entry.isIntersecting))
    observer.observe(target); return () => observer.disconnect()
  }, [])
  // 底部進入畫面且已顯示的週都載完，才加下一週；不預先載入。寬螢幕並排時先補滿同一列。
  const shownWeeks = weeks.slice(0, count)
  const allLoaded = shownWeeks.every(week => loaded.includes(week.id))
  useEffect(() => {
    // 以實際位置再確認一次，避免剛載完的週還沒撐開版面就連帶載入下一週。
    const inView = (sentinel.current?.getBoundingClientRect().top ?? Infinity) <= window.innerHeight
    const columns = grid.current ? getComputedStyle(grid.current).gridTemplateColumns.split(' ').length : 1
    if (allLoaded && count < weeks.length && ((atEnd && inView) || count % columns)) setCount(current => current + 1)
  }, [atEnd, allLoaded, count, weeks.length])
  const onLoaded = useCallback((id: string) => setLoaded(current => current.includes(id) ? current : [...current, id]), [])
  async function runSync() {
    setSyncing(true); setError('')
    try {
      let status: Sync
      do {
        const data = await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) })
        status = data.sync; if (!alive.current) break
        setSync(status)
        await refresh()
      } while (status.remaining > 0 && !status.busy && alive.current)
    } catch (e) { setError((e as Error).message) } finally { if (alive.current) setSyncing(false) }
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-mc-text/70">本週起依序列出，往下捲動載入下一週。</p>
      <Link className="shrink-0 px-2 py-3 text-sm text-mc-text/70 hover:text-mc-text" href="/bulletin/midweek-meeting">查看公開頁 ↗</Link>
    </div>
    {!loading && <details className="rounded-xl border border-white/10 px-4">
      <summary className="cursor-pointer py-3 text-sm text-mc-text/70">更多管理</summary>
      <div className="space-y-3 border-t border-white/10 py-4">
        <h2 className="text-sm font-semibold">手冊匯入</h2>
        <button className={button} disabled={syncing} onClick={runSync}>{syncing ? '匯入中…' : '檢查／匯入手冊'}</button>
        <p className="text-sm text-mc-text/70">預計下次檢查新手冊：{nextMidweekCheck(sync).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}（台北時間）</p>
        {!!sync?.errors.length && <details className="text-sm text-amber-300"><summary className="cursor-pointer py-2">部分來源待重試，將於下次排程繼續檢查</summary>{sync.errors.map(e => <p key={e.url}><a className="underline" href={e.url} target="_blank" rel="noreferrer">來源頁面</a>：{e.error}</p>)}</details>}
      </div>
    </details>}
    {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-red-300">{error}</p>}
    {loading && <p role="status">載入中…</p>}
    {!loading && !weeks.length && !error && <p className="py-8 text-mc-text/60">目前沒有本週或未來的節目，請展開「更多管理」匯入手冊。</p>}
    <div ref={grid} className="grid items-start gap-x-6 gap-y-10 [grid-template-columns:repeat(auto-fill,minmax(min(100%,34rem),1fr))]">
      {shownWeeks.map(week => <MidweekWeek key={week.id} week={week} members={members} palette={palette} onLoaded={onLoaded} />)}
    </div>
    <div ref={sentinel} aria-hidden="true" className="h-px" />
    {!loading && count >= weeks.length && weeks.length > 1 && <p className="py-4 text-center text-sm text-mc-text/50">已列出全部 {weeks.length} 週</p>}
  </div>
}
