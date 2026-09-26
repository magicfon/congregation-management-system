'use client'

import { useEffect, useRef, useState } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import RequestSubmitBar from '../../components/map/RequestSubmitBar'
import AreaStatusMap from '../../components/map/AreaStatusMap'
import { DISTRICT_NAMES } from '../../lib/allocation'
import { HEAT_STATUS_LABELS, type AreaStatusData } from '../../lib/area-status'

export default function AreaStatusPage() {
  const detailPanel = useRef<HTMLElement>(null)
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
        if (!controller.signal.aborted) setData(result)
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
        <select aria-label="選擇大地圖" value={mapId} onChange={e => setMapId(e.target.value)} className="rounded-lg border border-white/10 bg-mc-card px-2 py-1.5 text-sm">
          {Object.entries(DISTRICT_NAMES).map(([id, name]) => <option key={id} value={id}>{name}大地圖</option>)}
        </select>
        <button onClick={() => setRevision(v => v + 1)} disabled={loading} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs disabled:opacity-40">重新整理</button>
      </div>
    </header>
    <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <div className="w-44"><div className="h-2 rounded-full" style={{ background: maxDays === null ? '#64748b' : maxDays === 0 ? '#22c55e' : 'linear-gradient(to right, #22c55e, #facc15, #ef4444)' }} /><div className="flex justify-between mt-0.5 text-mc-text/60"><span>0 天</span><span>{maxDays === null ? '無紀錄' : `${maxDays} 天`}</span></div></div>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={grayDispatched} onChange={e => setGrayDispatched(e.target.checked)} />已分發地圖顯示灰色</label>
      <span className="hidden lg:inline text-mc-text/50">距上次完成回報 · 三區共用色階</span>
    </div>
    <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)_minmax(0,0.85fr)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-2">
      <div className="min-h-0 min-w-0 relative">
        {loading && <div role="status" className="h-full rounded-xl bg-mc-card flex items-center justify-center text-sm text-mc-text/60">正在載入分區…</div>}
        {error && <div role="alert" className="h-full overflow-auto rounded-xl border border-red-400/30 p-4 text-red-300">{error} {signedOut && <a className="underline" href="/login?callbackUrl=/area-status">重新登入</a>}</div>}
        {data && !loading && <AreaStatusMap data={data} selectedId={selectedId} onSelect={setSelectedId} grayDispatched={grayDispatched} />}
      </div>
      <aside ref={detailPanel} aria-label="區塊明細與領圖申請" className="min-h-0 min-w-0 overflow-y-auto overscroll-contain space-y-2 rounded-xl">
        <section aria-live="polite" className="rounded-xl border border-white/10 bg-mc-card p-3">
          {selected ? <>
            <h2 className="font-semibold">{selected.numbers.length ? `${selected.numbers.join('、')} 號` : '未配對區塊'}</h2>
            <p className="text-sm text-mc-text/70 mt-1">{selected.days === null ? HEAT_STATUS_LABELS[selected.status] : `距上次完成回報 ${selected.days} 天`}</p>
            {selected.numbers.length > 1 && <p className="text-xs text-yellow-300 mt-1">多編號區塊，以最久天數呈現</p>}
            <div className="mt-2 space-y-1">{selected.reports.map(r => <label key={r.number} className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-sm">
              <input type="checkbox" aria-label={`申請${r.number}號`} checked={queue.some(i => i.id === r.areaId)} disabled={!r.areaId || r.isDispatched || (queue.length >= 5 && !queue.some(i => i.id === r.areaId))} onChange={e => { const checked = e.target.checked; if (r.areaId) setQueue(old => checked ? old.some(i => i.id === r.areaId) || old.length >= 5 ? old : [...old, { id: r.areaId!, label: `${DISTRICT_NAMES[mapId]} ${r.number} 號` }] : old.filter(i => i.id !== r.areaId)) }} />
              <span className="flex-1"><strong>{r.number} 號</strong><span className="ml-2 text-xs text-mc-text/60">{r.isDispatched ? '使用中' : r.areaId ? '勾選申請' : '未配對'}</span><span className="block text-xs text-mc-text/50">完成回報：{r.lastCompletedDate || '無紀錄'}</span></span>
              <span className="tabular-nums whitespace-nowrap">{r.days === null ? '—' : `${r.days} 天`}</span>
            </label>)}</div>
          </> : <><h2 className="font-semibold">區塊明細</h2><p className="mt-1 text-sm text-mc-text/60">點選地圖色塊，即可在此查看回報日期與勾選申請。</p></>}
        </section>
        <RequestSubmitBar items={queue} onRemove={id => setQueue(old => old.filter(i => i.id !== id))} onSubmitted={() => { setQueue([]); setRevision(v => v + 1) }} />
        {data && <details className="rounded-xl border border-white/10 bg-mc-card p-3 text-xs text-mc-text/60"><summary className="cursor-pointer">圖例與資料資訊</summary><div className="mt-2 space-y-2">
          <p>{known.length} 塊可上色 · {data.regions.length - known.length} 塊灰色。灰色代表使用中（勾選時）、無紀錄、待配對或資料不完整。</p>
          <p>計算截至 {data.today}（台北）<br />回報日期同步：{synchronized}</p>
          {!data.syncedAt && <p className="text-yellow-300">完成回報日期尚未同步，目前以灰色顯示。</p>}
          <p>{data.boundary.source === 'cloud' ? `雲端分區草稿 v${data.boundary.version}` : '原始分區候選（尚無雲端草稿）'}；分區仍在人工核對中。</p>
          <p>「領取後多久」請至使用中地圖查看。</p>
          {!!data.unlocatedNumbers.length && <p>尚未定位：{data.unlocatedNumbers.join('、')} 號</p>}
        </div></details>}
      </aside>
    </div>
  </div></DashboardLayout>
}
