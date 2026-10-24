'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'

type Area = { sheetNo: number; label: string; holder: string | null; dispatched: string | null }
type Options = { name: string; today: string; timeslots: string[]; held: Area[]; areas: Area[] }
const OTHER = 'other'
const control = 'min-h-12 w-full rounded-lg border border-white/10 bg-mc-accent px-3 text-base'
const label = 'mb-1 block text-sm text-mc-text/70'

export default function TerritoryReport({ formUrl }: { formUrl: string }) {
  const [options, setOptions] = useState<Options | null>(null)
  const [guest, setGuest] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [areaChoice, setAreaChoice] = useState('')
  const [customNo, setCustomNo] = useState('')
  const [slotChoice, setSlotChoice] = useState('')
  const [customSlot, setCustomSlot] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const lock = useRef(false)

  async function load() {
    setError('')
    try {
      const res = await fetch('/api/territory-reports', { cache: 'no-store' })
      if (res.status === 401) { setGuest(true); return }
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '無法讀取區域資料')
      setOptions(value)
      setAreaChoice(current => current && (current === OTHER || value.held.some((a: Area) => String(a.sheetNo) === current)) ? current : value.held[0] ? String(value.held[0].sheetNo) : OTHER)
      setSlotChoice(current => current || value.timeslots[0] || OTHER)
      setEndDate(current => current || value.today)
    } catch (e) { setError(e instanceof Error ? e.message : '無法讀取區域資料') }
  }
  useEffect(() => { void load() }, [])

  const sheetNo = areaChoice === OTHER ? Number(customNo) : Number(areaChoice)
  const area = options?.areas.find(a => a.sheetNo === sheetNo)
  const own = options?.held.find(a => a.sheetNo === sheetNo)
  const timeslot = slotChoice === OTHER ? customSlot.trim() : slotChoice
  const willReturn = Boolean(area?.holder && (!area.dispatched || endDate >= area.dispatched))
  const problem = !area ? (areaChoice === OTHER && customNo ? '找不到這個區域號碼（1–213）' : '')
    : startDate && endDate && startDate > endDate ? '結束日不能早於開始日'
    : options && endDate > options.today ? '結束日不能晚於今天'
    : own?.dispatched && endDate && endDate < own.dispatched ? `結束日早於您的領取日（${own.dispatched}）`
    : ''

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current || !area || problem || !timeslot || !startDate || !endDate) return
    if (willReturn && !own && !window.confirm(`${area.label} 目前由 ${area.holder} 領取，送出後會交回這張地圖。確定送出？`)) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const res = await fetch('/api/territory-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetNo, timeslot, startDate, endDate, note }) })
      const value = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(value.error || '回報未送出，請稍後再試')
      setNotice(`已送出 ${area.label} 的回報${value.returned ? '，地圖已交回' : ''}。${value.warning || ''}`)
      setNote(''); setStartDate(''); setCustomNo('')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '回報未送出') } finally { lock.current = false; setBusy(false) }
  }

  const formLink = <a href={formUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-blue-300">改用 Google 表單<ExternalLink aria-hidden="true" className="h-4 w-4" /><span className="sr-only">（另開分頁）</span></a>
  if (guest) return <section className="rounded-2xl border border-white/10 bg-mc-card p-4 sm:p-6">
    <h2 className="font-semibold">區域回報</h2>
    <p className="mt-2 text-sm text-mc-text/60">登入後即可在這裡回報，姓名與領取中的地圖會自動帶入。</p>
    <div className="mt-4 flex flex-wrap items-center gap-4"><a href="/login?callbackUrl=%2Fbulletin%2Fterritory-report" className="inline-flex min-h-11 items-center rounded-lg bg-blue-400/15 px-4 text-sm text-blue-200">登入回報</a>{formLink}</div>
  </section>

  return <form onSubmit={e => void submit(e)} className="space-y-4 rounded-2xl border border-white/10 bg-mc-card p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">區域回報{options?.name && <span className="ml-2 text-sm font-normal text-mc-text/60">{options.name}</span>}</h2>{formLink}</div>
    {!options && !error && <p role="status" className="text-sm text-mc-text/50">正在讀取區域…</p>}
    {options && <>
      <div>
        <label htmlFor="report-area" className={label}>區域</label>
        <select id="report-area" value={areaChoice} onChange={e => setAreaChoice(e.target.value)} className={control}>
          {options.held.map(a => <option key={a.sheetNo} value={a.sheetNo}>{a.label}（{a.dispatched || '領取日未記錄'} 領取）</option>)}
          <option value={OTHER}>其他區域…</option>
        </select>
        {areaChoice === OTHER && <div className="mt-2">
          <input aria-label="區域號碼" inputMode="numeric" placeholder="區域號碼 1–213" value={customNo} onChange={e => setCustomNo(e.target.value.replace(/\D/g, '').slice(0, 3))} className={control} />
          {area && <p className="mt-1 text-xs text-mc-text/60">{area.label}・{area.holder ? `${area.holder} 領取中（${area.dispatched || '日期未記錄'}）` : '目前無人領取'}</p>}
        </div>}
      </div>
      <div>
        <label htmlFor="report-slot" className={label}>傳道時段</label>
        <select id="report-slot" value={slotChoice} onChange={e => setSlotChoice(e.target.value)} className={control}>
          {options.timeslots.map(slot => <option key={slot}>{slot}</option>)}
          <option value={OTHER}>其他時段…</option>
        </select>
        {slotChoice === OTHER && <input aria-label="其他時段" maxLength={30} placeholder="例如：星期五下午" value={customSlot} onChange={e => setCustomSlot(e.target.value)} className={`${control} mt-2`} />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="report-start" className={label}>開始日</label><input id="report-start" type="date" required max={endDate || options.today} value={startDate} onChange={e => setStartDate(e.target.value)} className={control} /></div>
        <div><label htmlFor="report-end" className={label}>結束日</label><input id="report-end" type="date" required min={startDate || undefined} max={options.today} value={endDate} onChange={e => setEndDate(e.target.value)} className={control} /></div>
      </div>
      <div><label htmlFor="report-note" className={label}>備註（選填）</label><textarea id="report-note" rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} className={`${control} py-2`} /></div>
      {problem && <p role="alert" className="text-sm text-amber-300">{problem}</p>}
      {area && !problem && willReturn && <p className="text-sm text-mc-text/60">送出後這張地圖會自動交回。</p>}
      <button type="submit" disabled={busy || !area || Boolean(problem) || !timeslot || !startDate || !endDate} className="min-h-12 w-full rounded-lg bg-blue-500 px-4 text-base font-semibold text-white disabled:opacity-40">{busy ? '送出中…' : '送出回報'}</button>
    </>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
  </form>
}
