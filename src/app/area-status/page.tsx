'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import RequestSubmitBar from '../../components/map/RequestSubmitBar'
import AreaStatusMap from '../../components/map/AreaStatusMap'
import { DISTRICT_NAMES } from '../../lib/allocation'
import { HEAT_STATUS_LABELS, type AreaStatusData } from '../../lib/area-status'

export default function AreaStatusPage() {
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
  const maxDays = data?.scaleMaxDays ?? null
  const selected = data?.regions.find(r => r.candidateId === selectedId)
  const known = data?.regions.filter(r => r.days !== null && !(grayDispatched && r.isDispatched)) || []
  const synchronized = data?.syncedAt ? new Date(data.syncedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '尚未同步'
  return <DashboardLayout><div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-3 text-mc-text">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold">區域狀況</h1><p className="text-sm text-mc-text/60 mt-1">距上次完成回報越久，顏色越接近紅色。</p></div>
      <div className="flex items-center gap-2">
        <select aria-label="選擇大地圖" value={mapId} onChange={e => setMapId(e.target.value)} className="rounded-lg border border-white/10 bg-mc-card px-3 py-2 text-sm">
          {Object.entries(DISTRICT_NAMES).map(([id, name]) => <option key={id} value={id}>{name}大地圖</option>)}
        </select>
        <button onClick={() => setRevision(v => v + 1)} disabled={loading} className="rounded-lg border border-white/10 bg-mc-card px-3 py-2 text-sm disabled:opacity-40">重新整理</button>
      </div>
    </div>
    <div className="rounded-xl border border-white/10 bg-mc-card p-3 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="w-64 max-w-full"><div className="h-3 rounded-full" style={{ background: maxDays === null ? '#64748b' : maxDays === 0 ? '#22c55e' : 'linear-gradient(to right, #22c55e, #facc15, #ef4444)' }} /><div className="flex justify-between text-xs text-mc-text/70 mt-1"><span>0 天</span>{maxDays !== null && maxDays > 0 && <span>{maxDays / 2} 天</span>}<span>{maxDays === null ? '尚無可計算日期' : maxDays === 0 ? '有效紀錄皆為 0 天' : `${maxDays} 天`}</span></div></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={grayDispatched} onChange={e => setGrayDispatched(e.target.checked)} />已分發地圖顯示灰色</label>
      <span className="flex items-center gap-2 text-xs text-mc-text/70"><span className="h-3 w-3 rounded bg-slate-500" />三區共用色階 · 灰色：無紀錄／待配對／資料不完整</span>
      {data && <span className="text-sm">{known.length} 塊可上色 · <span>全三區最久 <strong className="text-red-400">{maxDays ?? '—'}</strong> 天</span> · {data.regions.length - known.length} 塊灰色</span>}
    </div>
    <RequestSubmitBar items={queue} onRemove={id => setQueue(old => old.filter(i => i.id !== id))} onSubmitted={() => { setQueue([]); setRevision(v => v + 1) }} />
    {loading && <div role="status" className="min-h-[360px] rounded-xl border border-white/10 bg-mc-card flex items-center justify-center text-mc-text/60">正在載入分區與完成回報日期…</div>}
    {error && <div role="alert" className="rounded-xl border border-red-400/30 p-4 text-red-300">{error} {signedOut && <a className="underline" href="/login?callbackUrl=/area-status">重新登入</a>}</div>}
    {data && !loading && <>
      <div className="flex flex-wrap justify-between gap-1 text-xs text-mc-text/50">
        <span>計算截至 {data.today}（台北） · 回報日期同步：{synchronized}</span>
        <span>{data.boundary.source === 'cloud' ? `雲端分區草稿 v${data.boundary.version}` : '原始分區候選（尚無雲端草稿）'}</span>
      </div>
      {!data.syncedAt && <p role="status" className="text-sm text-yellow-300">完成回報日期尚未同步，目前以灰色顯示。</p>}
      <AreaStatusMap data={data} selectedId={selectedId} onSelect={setSelectedId} grayDispatched={grayDispatched} />
      <section aria-live="polite" className="rounded-xl border border-white/10 bg-mc-card p-3">
        {selected ? <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="font-semibold">{selected.numbers.length ? `${selected.numbers.join('、')} 號` : '未配對區塊'}</h2><span className="text-sm">{selected.days === null ? HEAT_STATUS_LABELS[selected.status] : `距上次完成回報 ${selected.days} 天`}</span>{selected.numbers.length > 1 && <span className="text-xs text-yellow-300">涵蓋多個編號；日期齊全時取最久天數</span>}</div>
          {selected.reports.length > 0 && <div className="max-h-40 overflow-auto mt-2"><table className="w-full text-sm text-left"><thead className="text-mc-text/50"><tr><th>申請</th><th className="py-1">區域</th><th>狀態</th><th>上次完成回報</th><th className="text-right">距今天數</th></tr></thead><tbody>{selected.reports.map(r => <tr key={r.number} className="border-t border-white/5"><td><input type="checkbox" aria-label={`申請${r.number}號`} checked={queue.some(i => i.id === r.areaId)} disabled={!r.areaId || r.isDispatched || (queue.length >= 5 && !queue.some(i => i.id === r.areaId))} onChange={e => { const checked = e.target.checked; if (r.areaId) setQueue(old => checked ? [...old, { id: r.areaId!, label: `${DISTRICT_NAMES[mapId]} ${r.number} 號` }] : old.filter(i => i.id !== r.areaId)) }} /></td><td className="py-1">{r.number} 號</td><td>{r.isDispatched ? '使用中' : r.areaId ? '可申請' : '未配對'}</td><td>{r.lastCompletedDate || '無紀錄'}</td><td className="text-right tabular-nums">{r.days === null ? '—' : `${r.days} 天`}</td></tr>)}</tbody></table></div>}
        </> : <p className="text-sm text-mc-text/60">點選色塊查看區域編號、上次完成回報日期及距今天數。可拖曳平移、滾輪縮放。</p>}
      </section>
      <p className="text-xs text-mc-text/50">分區仍為人工核對中的草稿；多編號色塊以最久天數呈現，不代表其中每一區的天數相同。「領取後多久」請至使用中地圖查看。</p>
      {data.unlocatedNumbers.length > 0 && <details className="text-xs text-mc-text/60"><summary className="cursor-pointer">{data.unlocatedNumbers.length} 個區域尚未在分區中定位</summary><p className="mt-2">{data.unlocatedNumbers.join('、')} 號</p></details>}
    </>}
  </div></DashboardLayout>
}
