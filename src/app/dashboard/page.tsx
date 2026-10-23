'use client'
import { useEffect, useState } from 'react'
import { ArrowRight, ChevronDown, MapPinned, Settings2 } from 'lucide-react'
import AdminTaskCenter from '../../components/dashboard/AdminTaskCenter'
import DashboardLayout from '../../components/layout/DashboardLayout'
import LineBotStatus from '../../components/dashboard/LineBotStatus'
import LineNotificationPreference from '../../components/dashboard/LineNotificationPreference'
import SyncCheck from '../../components/dashboard/SyncCheck'
import PersonalAssignmentsPanel from '../../components/dashboard/PersonalAssignments'
import type { PersonalAssignments } from '../../lib/personal-assignments'
import { adminManagementLinks } from '@/lib/navigation'
type Dashboard = { showTerritory: boolean; assignments: PersonalAssignments; handoffs: { areaId: string; label: string; publisher: string; submittedDate: string | null; next: {name: string; date: string} | null }[]; name: string; isAdmin: boolean; maps: { id: string; label: string; sheetNo: number | null; dispatchedDate: string | null; heldDays: number | null; ministryPending: number; ministryActive: boolean; report: { date: string; status: string } | null }[]; pendingRequests: { id: string; label: string; date: string }[]; reviewCount: number | null }
export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    void fetch('/api/dashboard', { cache: 'no-store', signal: controller.signal }).then(async res => {
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '讀取失敗')
      if (!controller.signal.aborted) setData(value)
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '讀取失敗') })
    return () => controller.abort()
  }, [revision])
  useEffect(() => {
    if (!data) return
    const view = new URLSearchParams(window.location.search).get('view')
    if (!view || !['maps', 'week', 'handoffs', 'assignments'].includes(view)) return
    const target = view === 'week' || (!data.showTerritory && ['maps', 'handoffs'].includes(view)) ? 'assignments' : view
    const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [data])
  return <DashboardLayout><div className="mx-auto max-w-5xl space-y-6 p-4 pb-10 text-mc-text selection:bg-blue-300/25 md:space-y-6 md:p-8 md:pb-14">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-white/10 pb-5">
      <h1 className="col-span-full text-2xl font-semibold tracking-tight">我的看板</h1>
      {data && <p className="min-w-0 break-words text-sm text-mc-text/70">{data.name}</p>}
      {data?.showTerritory && <a href="/area-status" className="inline-flex min-h-11 items-center justify-self-end gap-2 rounded-lg border border-white/15 px-4 text-sm text-blue-200 hover:bg-white/5"><MapPinned size={16} aria-hidden="true" />申請領圖</a>}
    </header>
    {error && <div role="alert" className="rounded-xl bg-red-400/10 p-4 text-red-200">{error}<button className="ml-3 min-h-11 underline underline-offset-4" onClick={() => setRevision(v => v + 1)}>重新載入</button></div>}
    {!data && !error && <div role="status" className="space-y-4"><span className="text-sm text-mc-text/70">正在載入看板…</span><div aria-hidden="true" className="h-48 rounded-xl bg-mc-card motion-safe:animate-pulse" /></div>}
    {data && <>
      <PersonalAssignmentsPanel data={data.assignments} kind={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('kind') === 'program' ? 'program' : 'service'} />
      {data.showTerritory && <>
        {!data.isAdmin && <section id="handoffs" data-dashboard-section="handoffs" className="dashboard-section scroll-mt-20">
          <div className="flex items-baseline justify-between gap-3"><h2 className="text-lg font-semibold">待交接</h2><span className={`text-sm ${data.handoffs.length ? 'text-amber-200' : 'text-mc-text/70'}`}>{data.handoffs.length} 張</span></div>
          {!data.handoffs.length ? <p className="mt-3 text-sm text-mc-text/70">目前無待交接地圖</p> : <div className="mt-3 divide-y divide-white/10">{data.handoffs.map(item => <details key={item.areaId} className="group">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden"><span className="font-medium">{item.label}</span><span className="ml-auto text-sm text-amber-200">{item.next ? '已有下一位' : '待安排'}</span><ChevronDown size={16} aria-hidden="true" className="shrink-0 text-mc-text/70 transition-transform group-open:rotate-180" /></summary>
            <div className="space-y-2 pb-5 text-sm text-mc-text/70"><p>{item.publisher} 已提交 · {item.submittedDate || '日期未記錄'}</p><p>{item.next ? `下一位：${item.next.name} · ${item.next.date}` : '尚未安排下一位'}</p><a href={`/map/ministry/${item.areaId}`} className="inline-flex min-h-11 items-center gap-2 text-blue-200">處理交接<ArrowRight size={16} aria-hidden="true" /></a></div>
          </details>)}</div>}
        </section>}
        <section id="maps" data-dashboard-section="maps" className="dashboard-section scroll-mt-20">
          <header className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-lg font-semibold">我的地圖 <span className="ml-2 text-sm font-normal text-mc-text/70">{data.maps.length} 張</span></h2><a href="/map-requests" className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-200">領圖申請{data.pendingRequests.length > 0 && <span className="text-amber-200">{data.pendingRequests.length} 待審</span>}<ArrowRight size={15} aria-hidden="true" /></a></header>
          {!data.maps.length ? <p className="py-5 text-sm text-mc-text/70">目前沒有持有地圖</p> : <div className="divide-y divide-white/10">{data.maps.map(map => <details key={map.id} className="group">
            <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 py-4 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1"><h3 className="break-words font-medium">{map.label}</h3><p className="mt-1 text-sm text-mc-text/70">{map.ministryActive ? '傳道進行中' : map.ministryPending ? `${map.ministryPending} 筆預排` : '尚無預排'}</p></div>
              <span className="shrink-0 text-sm tabular-nums text-mc-text/70">{map.heldDays === null ? '日期待補' : `持有 ${map.heldDays} 天`}</span><ChevronDown size={16} aria-hidden="true" className="shrink-0 text-mc-text/70 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 pb-6">
              <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-mc-text/70">領取日期</dt><dd className="mt-1">{map.dispatchedDate || '未記錄'}</dd></div><div><dt className="text-mc-text/70">本輪回報</dt><dd className="mt-1">{map.report ? `${map.report.date} 已提交` : map.dispatchedDate ? '尚未提交' : '無領取日期，無法判斷'}</dd></div></dl>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><a className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-300/15 px-4 text-blue-200 hover:bg-blue-300/25" href={`/map/ministry/${map.id}`}>管理／傳道進度<ArrowRight size={15} aria-hidden="true" /></a>{map.sheetNo && map.sheetNo !== 2 && <a className="inline-flex min-h-11 items-center text-mc-text/80 underline underline-offset-4" href={`/maps/areas/${map.sheetNo}.jpg`} target="_blank" rel="noreferrer">查看小地圖</a>}<a className="inline-flex min-h-11 items-center text-mc-text/80 underline underline-offset-4" href="/reports">查看／提交回報</a></div>
              <p className="text-xs leading-relaxed text-mc-text/70">提交回報不代表整張完成；交回後才會移出清單。</p>
            </div>
          </details>)}</div>}
          {data.pendingRequests.length > 0 && <details className="group border-t border-white/10"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm text-mc-text/70 [&::-webkit-details-marker]:hidden">待審申請明細 · {data.pendingRequests.length} 張<ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" /></summary><ul className="space-y-3 py-3">{data.pendingRequests.map(r => <li key={r.id} className="flex flex-wrap justify-between gap-2 text-sm"><span>{r.label}</span><time className="text-mc-text/70">{r.date}</time></li>)}</ul></details>}
        </section>
      </>}
      {/* 先看自己的委派與服務，再看管理待辦，最後是管理入口（ADR-0074）。 */}
      {data.isAdmin && <AdminTaskCenter />}
      {data.isAdmin && <nav aria-label="常用管理" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {adminManagementLinks.map(link => <a key={link.href} href={link.href} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/15 bg-mc-card px-4 text-sm text-mc-text hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"><Settings2 size={16} aria-hidden="true" />{link.label}<ArrowRight size={16} aria-hidden="true" className="ml-auto" /></a>)}
      </nav>}
      <footer className="space-y-4">
        <LineNotificationPreference />
        {data.isAdmin && <details className="group"><summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-sm text-mc-text/70 [&::-webkit-details-marker]:hidden"><Settings2 size={16} aria-hidden="true" />管理工具<ChevronDown size={16} aria-hidden="true" className="ml-auto transition-transform group-open:rotate-180" /></summary><div className="space-y-4 py-4"><SyncCheck /><LineBotStatus /></div></details>}
      </footer>
    </>}
  </div></DashboardLayout>
}
