'use client'
import { useId, useRef, useState } from 'react'
import { History, Settings2, RotateCw, CalendarDays, UserRound, Info, Check, Loader2, MessageSquare, ChevronDown } from 'lucide-react'
type Details = { personalTerritory: boolean; dispatchEnabled: boolean; sheetNo: number | null; sheetError: string | null; formReports: { row: number; submittedAt: string; memberName: string; completedDate: string }[]; reports: { id: string; content: string; status: string; submittedAt: string; member: { name: string } }[]; _count: { reports: number } }
export default function AreaProperties({ areaId, number, onChange }: { areaId: string; number: number; onChange: (id: string, enabled: boolean, personal: boolean) => void }) {
  const [panel, setPanel] = useState<'history' | 'settings' | null>(null)
  const [source, setSource] = useState<'form' | 'system'>('form')
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  const [data, setData] = useState<Details | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/areas/${areaId}/properties`, { cache: 'no-store' })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '載入失敗')
      setData(value); onChange(areaId, value.dispatchEnabled, value.personalTerritory)
    } catch (e) { setData(null); setError(e instanceof Error ? e.message : '載入失敗') }
    finally { setLoading(false) }
  }
  async function save() {
    if (!data || lock.current) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/areas/${areaId}/properties`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dispatchEnabled: !data.dispatchEnabled, expectedEnabled: data.dispatchEnabled }) })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '儲存失敗')
      setData({ ...data, dispatchEnabled: value.dispatchEnabled }); onChange(areaId, value.dispatchEnabled, data.personalTerritory)
      setMessage(value.dispatchEnabled ? '已開放申請與分發。' : '已暫停申請與分發，目前持有人不變。')
    } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗，請重新載入確認狀態') }
    finally { lock.current = false; setBusy(false) }
  }
  async function saveCategory(personal: boolean) {
    if (!data || lock.current || data.personalTerritory === personal) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/areas/${areaId}/properties`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personalTerritory: personal, expectedPersonalTerritory: data.personalTerritory }) })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '儲存失敗')
      setData({ ...data, personalTerritory: value.personalTerritory })
      onChange(areaId, data.dispatchEnabled, value.personalTerritory)
      setMessage('已儲存')
    } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗') }
    finally { lock.current = false; setBusy(false) }
  }
  function toggle(next: 'history' | 'settings') {
    setPanel(panel === next ? null : next)
    if (!data && !loading) void load()
  }
  const rows = source === 'form' ? data?.formReports ?? [] : data?.reports ?? []
  const count = source === 'form' ? data?.formReports.length : data?._count.reports
  return <div className="border-t border-white/10 pt-3 text-xs">
    <div className="grid grid-cols-2 gap-2">
      {([{ id: 'history', label: '回報', Icon: History }, { id: 'settings', label: '設定', Icon: Settings2 }] as const).map(({ id, label, Icon }) => <button key={id} type="button" aria-label={`${number} 號${label}`} aria-expanded={panel === id} aria-controls={panel === id ? panelId : undefined} onClick={() => toggle(id)} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border transition-colors ${panel === id ? 'border-blue-400/30 bg-blue-400/10 text-blue-300' : 'border-white/5 bg-white/5 text-mc-text/60 hover:bg-white/10'}`}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}
    </div>
    {panel && <section id={panelId} aria-label={`${number} 號${panel === 'history' ? '回報紀錄' : '分發設定'}`} className="mt-3 rounded-xl bg-white/[0.03] p-3">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-medium text-mc-text/80">{panel === 'history' ? '回報紀錄' : '分發設定'}</h3><button type="button" aria-label="重新載入" disabled={loading || busy} onClick={() => void load()} className="rounded p-2 text-mc-text/50 hover:bg-white/5 disabled:opacity-40"><RotateCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : ''} /></button></div>
      {loading && <p role="status" className="flex items-center gap-2 py-3 text-mc-text/50"><Loader2 size={15} className="animate-spin" aria-hidden="true" />載入中</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-400/10 p-2 text-red-300">{error}</p>}
      {data && !loading && panel === 'settings' && <>
        <div role="group" aria-label="區域分類" className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-black/15 p-1">
          {[false, true].map(personal => <button key={String(personal)} type="button" aria-pressed={data.personalTerritory === personal} disabled={busy || !!error} onClick={() => void saveCategory(personal)} className={`min-h-11 rounded-md px-2 disabled:opacity-40 ${data.personalTerritory === personal ? 'bg-blue-400/15 text-blue-300' : 'text-mc-text/50'}`}>{personal ? '個人區域' : '一般區域'}</button>)}
        </div>
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">開放分發</p><p className={`mt-1 ${data.dispatchEnabled ? 'text-emerald-300' : 'text-mc-text/50'}`}>{data.dispatchEnabled ? '可申請、可分發' : '已暫停'}</p></div><button type="button" role="switch" aria-label={`${number} 號開放分發`} aria-checked={data.dispatchEnabled} disabled={busy || !!error} onClick={() => void save()} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${data.dispatchEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}><span className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 shadow transition-transform ${data.dispatchEnabled ? 'translate-x-6' : 'translate-x-1'}`}>{busy ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : data.dispatchEnabled ? <Check size={12} aria-hidden="true" /> : null}</span></button></div>
        <details className="mt-3 text-mc-text/50"><summary className="flex cursor-pointer list-none items-center gap-1.5 py-1"><Info size={13} aria-hidden="true" />暫停後會如何？</summary><p className="mt-2 leading-relaxed">停止新申請、分發及核准；目前持有人與日期保持不變。</p></details>
      </>}
      {message && panel === 'settings' && <p role="status" className="mt-3 text-blue-300">{message}</p>}
      {data && !loading && panel === 'history' && <>
        <div className="mb-3 flex gap-1 rounded-lg bg-black/15 p-1">{(['form', 'system'] as const).map(id => <button type="button" key={id} aria-pressed={source === id} onClick={() => { setSource(id); setExpanded(false) }} className={`flex-1 rounded-md px-2 py-2 ${source === id ? 'bg-white/10 text-mc-text' : 'text-mc-text/50'}`}>{id === 'form' ? '表單' : '系統'} <span className="ml-1 text-mc-text/40">{id === 'form' ? data.sheetError ? '!' : data.formReports.length : data._count.reports}</span></button>)}</div>
        {source === 'form' && data.sheetError && <p role="alert" className="mb-3 text-amber-300">{data.sheetError}</p>}
        {source === 'form' && data.sheetNo === null && <p className="py-3 text-mc-text/50">尚未配對表單編號</p>}
        {!rows.length && !(source === 'form' && (data.sheetError || data.sheetNo === null)) && <div className="flex items-center gap-2 py-4 text-mc-text/40"><History size={20} aria-hidden="true" />尚無回報</div>}
        {!!rows.length && <><p className="mb-3 text-[11px] text-mc-text/40">依提交時間由新到舊{!expanded && rows.length > 3 ? ' · 最近 3 筆' : ''}</p><ol className="ml-1 border-l border-white/10">{(expanded ? rows : rows.slice(0, 3)).map(row => {
          const form = 'row' in row
          const date = form ? row.completedDate || '未填日期' : new Date(row.submittedAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
          return <li key={form ? `form-${row.row}` : row.id} className="relative pb-4 pl-4 last:pb-0"><span className={`absolute -left-[4px] top-1 h-2 w-2 rounded-full ${form ? 'bg-emerald-400' : 'bg-blue-400'}`} /><div className="flex flex-wrap items-center gap-2"><strong className="text-sm tabular-nums">{date}</strong><span className="text-[10px] text-mc-text/40">{form ? '完成' : '提交'}</span></div><p className="mt-1 flex items-center gap-1.5 text-mc-text/60"><UserRound size={12} aria-hidden="true" />{form ? row.memberName || '未填姓名' : row.member.name}</p><details className="mt-1.5"><summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-mc-text/40">{form ? <CalendarDays size={12} aria-hidden="true" /> : <MessageSquare size={12} aria-hidden="true" />}{form ? '提交資訊' : '回報內容'}<ChevronDown size={12} aria-hidden="true" /></summary>{form ? <p className="mt-2 text-mc-text/50">{row.submittedAt || '未填提交時間'}</p> : <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white/5 p-2 leading-relaxed text-mc-text/70">{row.content || '未填內容'}</p>}</details></li>
        })}</ol></>}
        {rows.length > 3 && <button type="button" onClick={() => setExpanded(v => !v)} className="mt-3 w-full rounded-lg border border-white/10 py-2 text-blue-300">{expanded ? '收合紀錄' : `查看其餘 ${rows.length - 3} 筆`}</button>}
        {source === 'system' && count !== undefined && count > rows.length && <p className="mt-2 text-mc-text/40">顯示最近 {rows.length} 筆，共 {count} 筆</p>}
      </>}
    </section>}
  </div>
}
