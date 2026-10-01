'use client'
import { useEffect, useState } from 'react'
import { Map, Clock3, MapPinned } from 'lucide-react'
import AdminTaskCenter from '../../components/dashboard/AdminTaskCenter'
import DashboardLayout from '../../components/layout/DashboardLayout'
import WeeklyMinistry from '../../components/dashboard/WeeklyMinistry'
import LineBotStatus from '../../components/dashboard/LineBotStatus'
import LineNotificationPreference from '../../components/dashboard/LineNotificationPreference'
import SyncCheck from '../../components/dashboard/SyncCheck'
type Dashboard = { today: string; handoffs: { areaId: string; label: string; publisher: string; submittedDate: string | null; next: {name: string; date: string} | null }[]; tasks: { id: string; areaId: string; label: string; date: string; status: string }[]; name: string; isAdmin: boolean; maps: { id: string; label: string; sheetNo: number | null; dispatchedDate: string | null; heldDays: number | null; ministryPending: number; ministryActive: boolean; report: { date: string; status: string } | null }[]; pendingRequests: { id: string; label: string; date: string }[]; reviewCount: number | null }
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
  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8 text-mc-text">
    <header className="flex items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">{data ? `${data.name}的地圖` : '我的地圖'}</h1><p className="mt-1 text-sm text-mc-text/50">查看領取進度與待辦事項</p></div><a href="/area-status" className="flex items-center gap-2 rounded-lg bg-mc-highlight px-3 py-2 text-sm"><MapPinned size={16} />申請領圖</a></header>
    {error && <div role="alert" className="rounded-xl bg-red-400/10 p-4 text-red-300">{error}<button className="ml-3 underline" onClick={() => setRevision(v => v + 1)}>重試</button></div>}
    {!data && !error && <p role="status" className="py-12 text-center text-mc-text/50">正在載入你的地圖…</p>}
    {data && <>
      {data.isAdmin && <AdminTaskCenter />}
      {!data.isAdmin && !!data.handoffs.length && <section className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4"><h2 className="mb-3 font-semibold text-amber-300">待交接 · {data.handoffs.length} 張</h2><div className="space-y-2">{data.handoffs.map(item => <a key={item.areaId} href={`/map/ministry/${item.areaId}`} className="flex items-center justify-between gap-3 rounded-lg bg-black/10 p-3"><div><strong>{item.label}</strong><p className="mt-1 text-xs text-mc-text/60">{item.publisher} 已提交 · {item.submittedDate || '日期未記錄'}</p><p className="mt-1 text-xs text-amber-200">{item.next ? `下一位：${item.next.name} · ${item.next.date}` : '尚未安排下一位'}</p></div><span className="shrink-0 text-sm">查看交接 →</span></a>)}</div></section>}
      <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 bg-mc-card p-4"><Map className="mb-2 text-blue-300" size={20} /><strong className="text-3xl">{data.maps.length}</strong><p className="mt-1 text-sm text-mc-text/60">我持有的地圖</p></div><a href="/map-requests" className="rounded-xl border border-white/10 bg-mc-card p-4"><Clock3 className="mb-2 text-amber-300" size={20} /><strong className="text-3xl">{data.pendingRequests.length}</strong><p className="mt-1 text-sm text-mc-text/60">我的待審申請</p></a></div>
      <WeeklyMinistry today={data.today} tasks={data.tasks} />
      <section><h2 className="mb-3 font-semibold">尚待完成交回</h2>{!data.maps.length ? <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-mc-text/50">目前沒有持有地圖，可前往區域狀況申請。</div> : <div className="grid gap-3 md:grid-cols-2">{data.maps.map(map => <article key={map.id} className="rounded-xl border border-white/10 bg-mc-card p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{map.label}</h3><span className="rounded-full bg-blue-400/10 px-2 py-1 text-xs text-blue-300">持有中</span></div><p className="mt-3 text-sm">{map.heldDays === null ? '領取日期未記錄' : <>已領取 <strong className="text-xl tabular-nums">{map.heldDays}</strong> 天</>}</p><p className="mt-1 text-xs text-mc-text/40">{map.dispatchedDate || '日期待確認'}</p><div className="my-3 border-t border-white/5 pt-3 text-xs">{map.report ? <p className="text-emerald-300">{map.report.date} 已提交系統回報</p> : <p className="text-amber-300">{map.dispatchedDate ? '本輪尚無系統回報' : '無領取日期，無法判斷本輪回報'}</p>}</div><p className="mb-3 text-xs text-blue-300">{map.ministryActive ? '傳道者進行中' : map.ministryPending ? `${map.ministryPending} 筆預排待交接` : '尚無待執行安排'}</p><div className="flex flex-wrap gap-2 text-sm"><a className="rounded-lg bg-mc-highlight px-3 py-2" href={`/map/ministry/${map.id}`}>管理／傳道進度</a>{map.sheetNo && map.sheetNo !== 2 && <a className="rounded-lg bg-white/5 px-3 py-2" href={`/maps/areas/${map.sheetNo}.jpg`} target="_blank" rel="noreferrer">查看小地圖 ↗</a>}<a className="rounded-lg border border-white/10 px-3 py-2 text-blue-300" href="/reports">查看／提交回報</a></div></article>)}</div>}<p className="mt-3 text-xs text-mc-text/40">系統回報不等於整張地圖已完成；完成交回後，地圖才會移出此清單。</p></section>
      {!!data.pendingRequests.length && <section className="rounded-xl border border-white/10 bg-mc-card p-4"><h2 className="mb-3 font-semibold">我的領圖申請</h2>{data.pendingRequests.map(r => <div key={r.id} className="flex items-center justify-between border-t border-white/5 py-2 text-sm"><span>{r.label}</span><span className="text-xs text-amber-300">待審核 · {r.date}</span></div>)}</section>}
      {data.isAdmin && <SyncCheck />}
      <LineNotificationPreference />
      {data.isAdmin && <LineBotStatus />}
    </>}
  </div></DashboardLayout>
}
