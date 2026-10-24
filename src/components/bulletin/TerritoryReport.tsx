'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Plus, X } from 'lucide-react'

type Area = { sheetNo: number; label: string; holder: string | null; dispatched: string | null }
type Options = { name: string; today: string; timeslots: string[]; maxAreas: number; held: Area[]; areas: Area[] }
const OTHER = 'other'
const control = 'min-h-12 w-full rounded-lg border border-white/10 bg-mc-accent px-3 text-base'
const label = 'mb-1 block text-sm text-mc-text/70'

export default function TerritoryReport({ formUrl }: { formUrl: string }) {
  const [options, setOptions] = useState<Options | null>(null)
  const [guest, setGuest] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [tags, setTags] = useState<number[]>([])
  const [areaText, setAreaText] = useState('')
  const [areaHint, setAreaHint] = useState('')
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
      setSlotChoice(current => current || value.timeslots[0] || OTHER)
      setEndDate(current => current || value.today)
    } catch (e) { setError(e instanceof Error ? e.message : '無法讀取區域資料') }
  }
  useEffect(() => { void load() }, [])

  const areaOf = (no: number) => options?.areas.find(a => a.sheetNo === no)
  const selected = tags.flatMap(no => areaOf(no) ? [areaOf(no)!] : [])
  const ownNos = new Set(options?.held.map(a => a.sheetNo))
  const timeslot = slotChoice === OTHER ? customSlot.trim() : slotChoice
  const returning = selected.filter(a => a.holder && (!a.dispatched || endDate >= a.dispatched))
  const lateOwn = selected.find(a => ownNos.has(a.sheetNo) && a.dispatched && endDate && endDate < a.dispatched)
  const problem = startDate && endDate && startDate > endDate ? '結束日不能早於開始日'
    : options && endDate > options.today ? '結束日不能晚於今天'
    : lateOwn ? `${lateOwn.label}：結束日早於您的領取日（${lateOwn.dispatched}）`
    : ''

  function addTag(no: number) {
    setAreaHint('')
    if (!areaOf(no)) { setAreaHint('找不到這個區域號碼（1–213）'); return false }
    if (tags.includes(no)) return true
    if (options && tags.length >= options.maxAreas) { setAreaHint(`一次最多回報 ${options.maxAreas} 區`); return false }
    setTags(current => [...current, no])
    return true
  }
  function areaKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !areaText && tags.length) { setTags(current => current.slice(0, -1)); return }
    if (!['Enter', ',', ' ', '，', '、'].includes(event.key)) return
    event.preventDefault()
    if (areaText && addTag(Number(areaText))) setAreaText('')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current || !selected.length || problem || !timeslot || !startDate || !endDate) return
    const others = returning.filter(a => !ownNos.has(a.sheetNo))
    if (others.length && !window.confirm(`${others.map(a => `${a.label}（${a.holder} 領取）`).join('、')} 送出後會交回。確定送出？`)) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const res = await fetch('/api/territory-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetNos: tags, timeslot, startDate, endDate, note }) })
      const value = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(value.error || '回報未送出，請稍後再試')
      setNotice(`已送出 ${selected.length} 區的回報${value.returned?.length ? `，交回 ${value.returned.length} 張地圖` : ''}。${value.warning || ''}`)
      setNote(''); setStartDate(''); setTags([]); setAreaText('')
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
        <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-mc-accent px-2 py-2">
          {selected.map(a => <button key={a.sheetNo} type="button" aria-label={`取消 ${a.label}`} onClick={() => setTags(current => current.filter(no => no !== a.sheetNo))} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-blue-400/15 px-3 text-sm text-blue-200 hover:bg-blue-400/25">{a.label}<X aria-hidden="true" className="h-3.5 w-3.5" /></button>)}
          <input id="report-area" inputMode="numeric" enterKeyHint="done" placeholder={tags.length ? '' : '輸入區號後按 Enter'} value={areaText} onKeyDown={areaKey} onBlur={() => { if (areaText && addTag(Number(areaText))) setAreaText('') }} onChange={e => { setAreaHint(''); setAreaText(e.target.value.replace(/\D/g, '').slice(0, 3)) }} className="min-h-9 min-w-[8rem] flex-1 bg-transparent px-1 text-base outline-none" />
        </div>
        {areaHint && <p role="alert" className="mt-1 text-xs text-amber-300">{areaHint}</p>}
        {options.held.some(a => !tags.includes(a.sheetNo)) && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs text-mc-text/50">我領取的：</span>{options.held.filter(a => !tags.includes(a.sheetNo)).map(a => <button key={a.sheetNo} type="button" onClick={() => addTag(a.sheetNo)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-white/10 px-3 text-sm text-mc-text/80 hover:bg-white/5"><Plus aria-hidden="true" className="h-3.5 w-3.5" />{a.label}</button>)}</div>}
        {selected.some(a => !ownNos.has(a.sheetNo)) && <ul className="mt-2 space-y-0.5 text-xs text-mc-text/60">{selected.filter(a => !ownNos.has(a.sheetNo)).map(a => <li key={a.sheetNo}>{a.label}・{a.holder ? `${a.holder} 領取中（${a.dispatched || '日期未記錄'}）` : '目前無人領取'}</li>)}</ul>}
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
      {!problem && returning.length > 0 && <p className="text-sm text-mc-text/60">送出後會自動交回：{returning.map(a => a.label).join('、')}</p>}
      <button type="submit" disabled={busy || !selected.length || Boolean(problem) || !timeslot || !startDate || !endDate} className="min-h-12 w-full rounded-lg bg-blue-500 px-4 text-base font-semibold text-white disabled:opacity-40">{busy ? '送出中…' : '送出回報'}</button>
    </>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
  </form>
}
