'use client'

import { useEffect, useRef, useState } from 'react'
import { UserRound, CalendarDays, Send, ClipboardPlus } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import DispatchSubmitBar from '../../components/map/DispatchSubmitBar'
import RequestSubmitBar from '../../components/map/RequestSubmitBar'
import AreaProperties from '../../components/map/AreaProperties'
import AreaStatusMap from '../../components/map/AreaStatusMap'
import { DISTRICT_NAMES } from '../../lib/allocation'
import { type AreaStatusData } from '../../lib/area-status'

export default function AreaStatusPage() {
  const [actionBusy, setActionBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminMode, setAdminMode] = useState<'dispatch' | 'request'>('dispatch')
  const dispatchMode = isAdmin && adminMode === 'dispatch'
  const [availability, setAvailability] = useState<Record<string, boolean>>({})
  useEffect(() => { const controller = new AbortController(); void fetch('/api/me', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(user => { if (!controller.signal.aborted) setIsAdmin(user?.role === 'admin') }).catch(() => {}); return () => controller.abort() }, [])
  function updateAvailability(id: string, enabled: boolean) {
    setAvailability(old => ({ ...old, [id]: enabled }))
    if (!enabled) setQueue(old => old.filter(item => item.id !== id))
  }
  const detailPanel = useRef<HTMLDivElement>(null)
  const [queue, setQueue] = useState<{ id: string; label: string }[]>([])
  const [grayDispatched, setGrayDispatched] = useState(true)
  const [mapId, setMapId] = useState('nanzih')
  const [data, setData] = useState<AreaStatusData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [signedOut, setSignedOut] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setData(null); setSelectedId(null); setSignedOut(false)
    void (async () => {
      try {
        const response = await fetch('/api/area-status/' + mapId, { cache: 'no-store', signal: controller.signal })
        if (response.status === 401) { setSignedOut(true); throw new Error('登入已過期，請重新登入查看區域狀況。') }
        if (!response.ok) throw new Error('無法載入區域狀況，請重試。')
        const result: AreaStatusData = await response.json()
        if (!controller.signal.aborted) {
          setData(result)
          setAvailability({})
          const reports = result.regions.flatMap(r => r.reports)
          setQueue(old => old.filter(item => !reports.some(r => r.areaId === item.id && (r.isDispatched || !r.dispatchEnabled))))
        }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '載入失敗') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [mapId, revision])
  useEffect(() => { if (detailPanel.current) detailPanel.current.scrollTop = 0 }, [selectedId])
  const maxDays = data?.scaleMaxDays ?? null
  const selected = data?.regions.find(r => r.candidateId === selectedId)
  const known = data?.regions.filter(r => r.days !== null && !(grayDispatched && r.isDispatched)) || []
  const synchronized = data?.syncedAt ? new Date(data.syncedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '尚未同步'
  return <DashboardLayout><div className="h-[calc(100dvh-3.5rem)] md:h-dvh max-w-[1920px] mx-auto p-2 md:p-3 flex flex-col gap-2 overflow-hidden text-mc-text">
    <header className="shrink-0 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-lg font-semibold">區域狀況</h1>
      <div className="flex items-center gap-2">
        <select aria-label="選擇大地圖" disabled={actionBusy} value={mapId} onChange={e => setMapId(e.target.value)} className="rounded-lg border border-white/10 bg-mc-card px-2 py-1.5 text-sm">
          {Object.entries(DISTRICT_NAMES).map(([id, name]) => <option key={id} value={id}>{name}大地圖</option>)}
        </select>
        <button onClick={() => setRevision(v => v + 1)} disabled={loading || actionBusy} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs disabled:opacity-40">重新整理</button>
      </div>
    </header>
    <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <div className="w-44"><div className="h-2 rounded-full" style={{ background: maxDays === null ? '#64748b' : maxDays === 0 ? '#22c55e' : 'linear-gradient(to right, #22c55e, #facc15, #ef4444)' }} /><div className="flex justify-between mt-0.5 text-mc-text/60"><span>0 天</span><span>{maxDays === null ? '無紀錄' : `${maxDays} 天`}</span></div></div>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={grayDispatched} onChange={e => setGrayDispatched(e.target.checked)} />已分發地圖顯示灰色</label>
      <span className="hidden lg:inline text-mc-text/50">距上次完成回報 · 三區共用色階</span>
    </div>
    <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-2">
      <div className="min-h-0 min-w-0 relative">
        {loading && <div role="status" className="h-full rounded-xl bg-mc-card flex items-center justify-center text-sm text-mc-text/60">正在載入分區…</div>}
        {error && <div role="alert" className="h-full overflow-auto rounded-xl border border-red-400/30 p-4 text-red-300">{error} {signedOut && <a className="underline" href="/login?callbackUrl=/area-status">重新登入</a>}</div>}
        {data && !loading && <AreaStatusMap data={data} selectedId={selectedId} onSelect={setSelectedId} grayDispatched={grayDispatched} queuedAreaIds={queue.map(i => i.id)} />}
      </div>
      <aside aria-label="區塊明細與領圖操作" className="min-h-0 min-w-0 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-mc-card">
        {isAdmin && <div className="shrink-0 border-b border-white/10 p-2">
          <div role="group" aria-label="領圖操作模式" className="grid grid-cols-2 gap-1 rounded-lg bg-black/15 p-1">
            {([{ mode: 'dispatch', label: '派發', Icon: Send }, { mode: 'request', label: '申請', Icon: ClipboardPlus }] as const).map(({ mode, label, Icon }) => <button key={mode} type="button" aria-pressed={adminMode === mode} disabled={actionBusy || (mode === 'request' && queue.length > 5)} onClick={() => setAdminMode(mode)} className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm disabled:opacity-40 ${adminMode === mode ? 'bg-blue-400/15 text-blue-300' : 'text-mc-text/50 hover:bg-white/5'}`}><Icon size={15} aria-hidden="true" />{label}</button>)}
          </div>
          <p className="mt-1 text-center text-[11px] text-mc-text/50">{queue.length > 5 ? '選取降至 5 張以內，即可切換申請' : dispatchMode ? '為成員直接派發地圖' : '為自己申請領取 · 最多 5 張'}</p>
        </div>}
        <div ref={detailPanel} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <section aria-live="polite" className="p-3">
          {selected ? <>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{DISTRICT_NAMES[mapId]} {selected.numbers.length ? `${selected.numbers.join('、')} 號` : '未配對區塊'}</h2><button aria-label="取消查看區塊" onClick={() => setSelectedId(null)} className="px-2 py-1 text-mc-text/50">×</button></div>
            {selected.numbers.length > 1 && <p className="mb-3 text-xs text-amber-300">此區塊包含多張地圖，請逐張選取。</p>}
            {!selected.reports.length && <p className="text-sm text-mc-text/60">尚未對應地圖號碼，請先在編輯器指定號碼。</p>}
            <div className="space-y-4">{selected.reports.map(r => {
              const enabled = (r.areaId ? availability[r.areaId] : undefined) ?? r.dispatchEnabled
              const queued = queue.some(i => i.id === r.areaId)
              const unavailable = !enabled || !r.areaId || r.isDispatched
              const status = !r.areaId ? '未配對' : r.isDispatched ? '使用中' : !enabled ? '暫停分發' : dispatchMode ? '可分發' : '可申請'
              return <article key={r.number} className="space-y-3 border-b border-white/10 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between"><span className="text-sm text-mc-text/60">{selected.numbers.length > 1 ? `${r.number} 號` : '地圖狀態'}</span><span className={`rounded-full px-2 py-1 text-xs ${unavailable ? 'bg-white/5 text-mc-text/60' : 'bg-emerald-400/10 text-emerald-300'}`}>{status}</span></div>
                {r.isDispatched && <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"><dt className="flex items-center gap-1.5 text-mc-text/50"><UserRound size={14} aria-hidden="true" />持有人</dt><dd>{r.assignedTo || '未記錄'}</dd><dt className="flex items-center gap-1.5 text-mc-text/50"><CalendarDays size={14} aria-hidden="true" />領取日</dt><dd>{r.dispatchedDate || '未記錄'}</dd></dl>}
                <div><p className="text-xs text-mc-text/60">距上次完成回報</p><p className="mt-1"><strong className="text-3xl font-semibold tabular-nums">{data?.syncedAt && r.days !== null ? r.days : '—'}</strong><span className="ml-1 text-sm text-mc-text/60">天</span></p><p className="mt-1 flex items-center gap-1.5 text-xs text-mc-text/50"><CalendarDays size={13} aria-hidden="true" />{!data?.syncedAt ? '回報日期尚未同步' : `上次完成：${r.lastCompletedDate || '無紀錄'}`}</p></div>
                {!unavailable && <button disabled={actionBusy || (!dispatchMode && queue.length >= 5 && !queued)} aria-pressed={queued} onClick={() => { if (r.areaId) setQueue(old => old.some(i => i.id === r.areaId) ? old.filter(i => i.id !== r.areaId) : !dispatchMode && old.length >= 5 ? old : [...old, { id: r.areaId!, label: `${DISTRICT_NAMES[mapId]} ${r.number} 號` }]) }} className={`w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-40 ${queued ? 'bg-blue-400/10 text-blue-300' : 'bg-mc-highlight text-white'}`}>{queued ? '✓ 已加入 · 點此移除' : dispatchMode ? '＋ 加入分發清單' : queue.length >= 5 ? '已選滿 5 張' : '＋ 加入申請'}</button>}
                {isAdmin && r.areaId && <AreaProperties key={r.areaId} areaId={r.areaId} number={r.number} onChange={updateAvailability} />}
              </article>
            })}</div>
          </> : <div className="py-6 text-center"><p className="text-2xl text-mc-text/30">◎</p><h2 className="mt-2 font-semibold">點選地圖，查看區域</h2><p className="mt-2 text-sm text-mc-text/50">查看多久未完成回報，<br />將想領取的地圖加入下方清單。</p></div>}
        </section>
        {data && <details className="rounded-xl border border-white/10 bg-mc-card p-3 text-xs text-mc-text/60"><summary className="cursor-pointer">圖例與資料資訊</summary><div className="mt-2 space-y-2">
          <p>{known.length} 塊可上色 · {data.regions.length - known.length} 塊灰色。灰色代表使用中（勾選時）、無紀錄、待配對或資料不完整。</p>
          <p>計算截至 {data.today}（台北）<br />回報日期同步：{synchronized}</p>
          {!data.syncedAt && <p className="text-yellow-300">完成回報日期尚未同步，目前以灰色顯示。</p>}
          <p>{data.boundary.source === 'cloud' ? `雲端分區草稿 v${data.boundary.version}` : '原始分區候選（尚無雲端草稿）'}；分區仍在人工核對中。</p>
          <p>「領取後多久」請至使用中地圖查看。</p>
          {!!data.unlocatedNumbers.length && <p>尚未定位：{data.unlocatedNumbers.join('、')} 號</p>}
        </div></details>}
        </div>
        <div className="shrink-0 border-t border-white/10 max-h-[45%] overflow-y-auto">
          {dispatchMode ? <DispatchSubmitBar items={queue} onBusy={setActionBusy} onRemove={id => setQueue(old => old.filter(i => i.id !== id))} onSubmitted={() => { setQueue([]); setRevision(v => v + 1) }} /> : <RequestSubmitBar compact onBusy={setActionBusy} items={queue} onRemove={id => setQueue(old => old.filter(i => i.id !== id))} onSubmitted={() => { setQueue([]); setRevision(v => v + 1) }} />}
        </div>
      </aside>
    </div>
  </div></DashboardLayout>
}
