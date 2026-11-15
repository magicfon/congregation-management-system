'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { RotateCw, Info, Check, Loader2 } from 'lucide-react'
type Details = { personalTerritory: boolean; personalManaged: boolean; dispatchEnabled: boolean; doNotVisit: string; holderId: string | null; holder: string | null }
type Category = 'general' | 'personal' | 'managed'
export type AreaCategory = { personal: boolean; managedBy: string | null }
const CATEGORY_LABELS: Record<Category, string> = { general: '一般區域', personal: '個人區域', managed: '個人管理' }
const categoryOf = (d: Details): Category => d.personalManaged ? 'managed' : d.personalTerritory ? 'personal' : 'general'
const categoryState = (d: Details): AreaCategory => ({ personal: d.personalTerritory, managedBy: d.personalManaged ? d.holder || '' : null })
// 區域狀況「設定」收合區的單張地圖分發設定（ADR-0089：回報紀錄已移除）
export default function AreaProperties({ areaId, number, showNumber, onChange }: { areaId: string; number: number; showNumber: boolean; onChange: (id: string, enabled: boolean, category: AreaCategory) => void }) {
  const panelId = useId()
  const [data, setData] = useState<Details | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [doNotVisit, setDoNotVisit] = useState<string | null>(null)
  const lock = useRef(false)
  // 個人管理要指定管理人（ADR-0130）：選了「個人管理」先挑人再儲存
  const [picking, setPicking] = useState(false)
  const [members, setMembers] = useState<{ id: string; name: string }[] | null>(null)
  const [managerId, setManagerId] = useState('')
  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/areas/${areaId}/properties`, { cache: 'no-store' })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '載入失敗')
      setData(value); setDoNotVisit(null); setPicking(false); onChange(areaId, value.dispatchEnabled, categoryState(value))
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
      setData({ ...data, dispatchEnabled: value.dispatchEnabled }); onChange(areaId, value.dispatchEnabled, categoryState(data))
      setMessage(value.dispatchEnabled ? '已開放申請與分發。' : '已暫停申請與分發，目前持有人不變。')
    } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗，請重新載入確認狀態') }
    finally { lock.current = false; setBusy(false) }
  }
  async function pickManager() {
    setPicking(true); setManagerId(data?.holderId || '')
    if (members) return
    try {
      const res = await fetch('/api/members?active=true', { cache: 'no-store' })
      const list = await res.json()
      if (!res.ok) throw new Error(list.error || '無法載入成員')
      setMembers((list as { id: string; name: string }[]).map(m => ({ id: m.id, name: m.name })).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')))
    } catch (e) { setPicking(false); setError(e instanceof Error ? e.message : '無法載入成員') }
  }
  async function saveCategory(category: Category, memberId?: string) {
    if (!data || lock.current) return
    if (category === 'managed' && !memberId) { void pickManager(); return }
    if (category === categoryOf(data) && category !== 'managed') return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/areas/${areaId}/properties`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, expectedCategory: categoryOf(data), memberId }) })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '儲存失敗')
      const holder = category === 'managed' ? members?.find(m => m.id === memberId)?.name || '' : data.holder
      const next = { ...data, personalTerritory: category === 'personal', personalManaged: category === 'managed', ...(category === 'managed' ? { holderId: memberId!, holder } : {}) }
      setData(next); setPicking(false)
      onChange(areaId, data.dispatchEnabled, categoryState(next))
      setMessage(value.warning || (category === 'managed' ? `已設為個人管理，由 ${holder} 自行回報領取與完成。` : data.personalManaged ? '已取消個人管理，目前持有人不變；需要時請收回。' : '已儲存'))
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
        <div role="group" aria-label="區域分類" className="grid grid-cols-3 gap-1 rounded-lg bg-black/15 p-1">
          {(['general', 'personal', 'managed'] as Category[]).map(category => <button key={category} type="button" aria-pressed={categoryOf(data) === category} disabled={busy || !!error} onClick={() => void saveCategory(category)} className={`min-h-11 rounded-md px-2 disabled:opacity-40 ${categoryOf(data) === category ? 'bg-blue-400/15 text-blue-300' : 'text-mc-text/50'}`}>{CATEGORY_LABELS[category]}</button>)}
        </div>
        {data.personalManaged && !picking && <p className="mt-2 flex items-center justify-between gap-2 text-mc-text/60"><span>管理人：<span className="text-mc-text">{data.holder || '未記錄'}</span>，不分發、不可申請，由管理人自行回報。</span><button type="button" disabled={busy} onClick={() => void pickManager()} className="shrink-0 rounded px-2 py-1 text-blue-300 hover:bg-white/5">更換</button></p>}
        {picking && <div className="mt-2 rounded-lg bg-black/15 p-2">
          <label htmlFor={`${panelId}-manager`} className="text-mc-text/60">個人管理的管理人</label>
          {!members ? <p role="status" className="flex items-center gap-2 py-2 text-mc-text/50"><Loader2 size={13} className="animate-spin" aria-hidden="true" />載入成員</p> : <select id={`${panelId}-manager`} value={managerId} onChange={e => setManagerId(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg bg-mc-accent px-2 text-sm"><option value="">選擇成員</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}
          <p className="mt-1 text-mc-text/50">地圖會固定由這位成員持有；他回報的開始日當領取日、結束日當完成日，不會交回。</p>
          <div className="mt-2 flex gap-2"><button type="button" disabled={busy || !managerId || (data.personalManaged && managerId === data.holderId)} onClick={() => void saveCategory('managed', managerId)} className="min-h-11 flex-1 rounded-lg bg-mc-highlight px-3 text-sm text-white disabled:opacity-40">設為個人管理</button><button type="button" disabled={busy} onClick={() => setPicking(false)} className="min-h-11 rounded-lg bg-white/5 px-3 text-sm">取消</button></div>
        </div>}
        <div className="mb-4" />
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
