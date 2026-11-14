'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { allocationLabel } from '../../lib/allocation'

// 區域狀態（ADR-0126）：LINE 管理頁「區域狀態」格。上方是自己的領圖申請，下方是目前誰領著哪些地圖。
type Area = { id: string; name: string; mapId: string | null; sheetNo: number | null; mapAreaId: number | null; dispatchedAt: string | null }
type Group = { memberId: string; memberName: string; count: number; areas: Area[] }
type Request = { id: string; memberId: string; status: string; createdAt: string; area: Omit<Area, 'id' | 'dispatchedAt'> }
const statusStyle: Record<string, [string, string]> = {
  pending: ['待審核', 'border-amber-300/40 text-amber-200'], approved: ['已核准', 'border-emerald-300/40 text-emerald-300'],
  rejected: ['已拒絕', 'border-red-300/40 text-red-200'], cancelled: ['已取消', 'border-white/15 text-mc-text/60'],
}
const RECENT = 5
const districts = ['nanzih', 'chiaotou', 'tzuguan']
// 依楠梓、橋頭、梓官，再依號碼排。
const mapOrder = (a: Area) => { const d = districts.indexOf(a.mapId || ''); return (d < 0 ? 9 : d) * 10000 + (a.sheetNo ?? a.mapAreaId ?? 9999) }
const taipeiDate = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date(iso))
function heldDays(iso: string | null) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86400000))
}
const daysTone = (days: number | null) => days === null ? 'text-blue-300' : days >= 60 ? 'text-red-300' : days >= 30 ? 'text-amber-200' : 'text-mc-text/60'

export default function TerritoryStatusPage() {
  const [me, setMe] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [requests, setRequests] = useState<Request[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const read = async (url: string) => {
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || '讀取失敗，請確認登入狀態')
        return data
      }
      const [user, dispatched, mine] = await Promise.all([read('/api/me'), read('/api/areas/dispatched'), read('/api/map-requests')])
      setMe(user.id); setGroups(dispatched.groups); setRequests(mine.requests)
    } catch (e) { setError(e instanceof Error ? e.message : '讀取失敗') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  // 管理者的 /api/map-requests 會回傳全部人的申請，這裡只看自己的。
  const own = useMemo(() => (requests ?? []).filter(r => r.memberId === me), [requests, me])
  const pending = own.filter(r => r.status === 'pending')
  const recent = own.filter(r => r.status !== 'pending').slice(0, RECENT)
  const holders = useMemo(() => {
    const needle = q.trim()
    const list = (groups ?? []).map(g => ({ ...g, areas: [...g.areas].sort((a, b) => mapOrder(a) - mapOrder(b)) }))
      .filter(g => !needle || g.memberName.includes(needle) || g.areas.some(a => allocationLabel(a).includes(needle)))
    return [...list.filter(g => g.memberId === me), ...list.filter(g => g.memberId !== me)]
  }, [groups, me, q])
  const total = (groups ?? []).reduce((sum, g) => sum + g.count, 0)

  return <DashboardLayout><div className="mx-auto max-w-3xl space-y-6 p-4 pb-10 text-mc-text md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
      <h1 className="text-2xl font-semibold tracking-tight">區域狀態</h1>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm disabled:opacity-40"><RefreshCw size={15} aria-hidden="true" className={loading ? 'motion-safe:animate-spin' : ''} />重新整理</button>
    </header>
    {error && <div role="alert" className="rounded-xl bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
    {loading && !groups && <div role="status" className="space-y-3"><span className="text-sm text-mc-text/70">正在載入…</span><div aria-hidden="true" className="h-40 rounded-xl bg-mc-card motion-safe:animate-pulse" /></div>}

    {requests && <section aria-labelledby="my-requests" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="my-requests" className="text-lg font-semibold">我的申請 {pending.length > 0 && <span className="ml-1 text-sm font-normal text-amber-200">{pending.length} 張待審</span>}</h2>
        <a href="/area-status" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-blue-200">到傳道地圖申請<ArrowRight size={15} aria-hidden="true" /></a>
      </div>
      {!pending.length && !recent.length ? <p className="rounded-xl bg-mc-card p-4 text-sm text-mc-text/70">目前沒有申請紀錄</p>
        : <ul className="divide-y divide-white/10 rounded-xl bg-mc-card px-4">{[...pending, ...recent].map(r => {
          const [label, tone] = statusStyle[r.status] ?? [r.status, 'border-white/15']
          return <li key={r.id} className="flex min-h-14 items-center gap-3 py-2"><span className="min-w-0 flex-1 font-medium">{allocationLabel(r.area)}</span><time className="text-sm tabular-nums text-mc-text/60">{taipeiDate(r.createdAt)}</time><span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${tone}`}>{label}</span></li>
        })}</ul>}
      {own.length > 0 && <a href="/map-requests" className="inline-flex min-h-11 items-center text-sm text-mc-text/70 underline underline-offset-4">{pending.length ? '取消申請或查看全部紀錄' : '查看全部申請紀錄'}</a>}
    </section>}

    {groups && <section aria-labelledby="holders" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="holders" className="text-lg font-semibold">目前領圖</h2>
        <span className="text-sm text-mc-text/70">{groups.length} 人 · {total} 張</span>
      </div>
      <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋人名或地圖號碼" aria-label="搜尋人名或地圖號碼" className="min-h-11 w-full rounded-lg border border-white/10 bg-mc-card px-3 text-sm placeholder:text-mc-text/40" />
      {!holders.length ? <p className="rounded-xl bg-mc-card p-4 text-sm text-mc-text/70">{q.trim() ? '找不到符合的人或地圖' : '目前沒有人領著地圖'}</p>
        : <ul className="divide-y divide-white/10 rounded-xl bg-mc-card px-4">{holders.map(g => <li key={g.memberId} className="py-3">
          <div className="flex items-baseline justify-between gap-2"><span className="font-medium">{g.memberName}{g.memberId === me && <span className="ml-2 rounded bg-blue-400/15 px-1.5 py-0.5 text-xs text-blue-200">我</span>}</span><span className="text-sm tabular-nums text-mc-text/60">{g.count} 張</span></div>
          <ul className="mt-2 flex flex-wrap gap-1.5">{g.areas.map(a => { const days = heldDays(a.dispatchedAt); return <li key={a.id} className="rounded-lg bg-white/5 px-2.5 py-1 text-sm">{allocationLabel(a)}<span className={`ml-1.5 text-xs tabular-nums ${daysTone(days)}`}>{days === null ? '日期待補' : `${days} 天`}</span></li> })}</ul>
        </li>)}</ul>}
      <p className="text-xs text-mc-text/60">天數是從領取日算起；30 天以上黃色，60 天以上紅色。</p>
    </section>}
  </div></DashboardLayout>
}
