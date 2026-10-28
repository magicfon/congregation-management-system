'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { RotateCw, Info, Check, Loader2 } from 'lucide-react'
type Details = { personalTerritory: boolean; dispatchEnabled: boolean; doNotVisit: string }
// 區域狀況「設定」收合區的單張地圖分發設定（ADR-0089：回報紀錄已移除）
export default function AreaProperties({ areaId, number, showNumber, onChange }: { areaId: string; number: number; showNumber: boolean; onChange: (id: string, enabled: boolean, personal: boolean) => void }) {
  const panelId = useId()
  const [data, setData] = useState<Details | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [doNotVisit, setDoNotVisit] = useState<string | null>(null)
  const lock = useRef(false)
  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/areas/${areaId}/properties`, { cache: 'no-store' })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '載入失敗')
      setData(value); setDoNotVisit(null); onChange(areaId, value.dispatchEnabled, value.personalTerritory)
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
  async function saveDoNotVisit() {
    if (!data || lock.current || doNotVisit === null) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/areas/${areaId}/properties`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doNotVisit, expectedDoNotVisit: data.doNotVisit }) })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '儲存失敗')
      setData({ ...data, doNotVisit: value.doNotVisit }); setDoNotVisit(null)
      setMessage(value.warning || '拒絕拜訪已儲存，並寫入 Sheet。')
    } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗') }
    finally { lock.current = false; setBusy(false) }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [areaId])
  return <section aria-label={`${number} 號分發設定`} className="text-xs">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium text-mc-text/80">{showNumber ? `${number} 號` : '分發設定'}</h3><button type="button" aria-label="重新載入" disabled={loading || busy} onClick={() => void load()} className="rounded p-2 text-mc-text/50 hover:bg-white/5 disabled:opacity-40"><RotateCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : ''} /></button></div>
      {loading && <p role="status" className="flex items-center gap-2 py-3 text-mc-text/50"><Loader2 size={15} className="animate-spin" aria-hidden="true" />載入中</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-400/10 p-2 text-red-300">{error}</p>}
      {data && !loading && <>
        <div role="group" aria-label="區域分類" className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-black/15 p-1">
          {[false, true].map(personal => <button key={String(personal)} type="button" aria-pressed={data.personalTerritory === personal} disabled={busy || !!error} onClick={() => void saveCategory(personal)} className={`min-h-11 rounded-md px-2 disabled:opacity-40 ${data.personalTerritory === personal ? 'bg-blue-400/15 text-blue-300' : 'text-mc-text/50'}`}>{personal ? '個人區域' : '一般區域'}</button>)}
        </div>
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">開放分發</p><p className={`mt-1 ${data.dispatchEnabled ? 'text-emerald-300' : 'text-mc-text/50'}`}>{data.dispatchEnabled ? '可申請、可分發' : '已暫停'}</p></div><button type="button" role="switch" aria-label={`${number} 號開放分發`} aria-checked={data.dispatchEnabled} disabled={busy || !!error} onClick={() => void save()} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${data.dispatchEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}><span className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 shadow transition-transform ${data.dispatchEnabled ? 'translate-x-6' : 'translate-x-1'}`}>{busy ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : data.dispatchEnabled ? <Check size={12} aria-hidden="true" /> : null}</span></button></div>
        <details className="mt-3 text-mc-text/50"><summary className="flex cursor-pointer list-none items-center gap-1.5 py-1"><Info size={13} aria-hidden="true" />暫停後會如何？</summary><p className="mt-2 leading-relaxed">停止新申請、分發及核准；目前持有人與日期保持不變。</p></details>
        <div className="mt-4 border-t border-white/10 pt-3">
          <label htmlFor={`${panelId}-dnv`} className="text-sm font-medium">拒絕拜訪</label>
          <p className="mt-1 text-mc-text/50">一行一個地址，註記接在地址後；與 Sheet J 欄同步。</p>
          <textarea id={`${panelId}-dnv`} rows={3} maxLength={3000} disabled={busy || !!error} value={doNotVisit ?? data.doNotVisit} onChange={e => setDoNotVisit(e.target.value)} placeholder="例如：加昌路279巷5號" className="mt-2 w-full rounded-lg bg-mc-accent p-2 text-sm" />
          {doNotVisit !== null && doNotVisit !== data.doNotVisit && <div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={() => void saveDoNotVisit()} className="min-h-11 flex-1 rounded-lg bg-mc-highlight px-3 text-sm text-white disabled:opacity-40">儲存拒絕拜訪</button><button type="button" disabled={busy} onClick={() => setDoNotVisit(null)} className="min-h-11 rounded-lg bg-white/5 px-3 text-sm">取消</button></div>}
        </div>
      </>}
      {message && <p role="status" className="mt-3 text-blue-300">{message}</p>}
  </section>
}
