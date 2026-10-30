'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ExternalLink, Plus, X } from 'lucide-react'

type Area = { sheetNo: number; label: string; holder: string | null; dispatched: string | null }
type Options = { guest: boolean; admin: boolean; name: string; today: string; timeslots: string[]; maxAreas: number; held: Area[]; areas: Area[] }
type Verdict = { sheetNo: number; action: 'return' | 'proxy' | 'confirm' | 'merge' | 'record' | 'blocked' | 'self'; reason: string }
const OTHER = 'other'
const control = 'min-h-12 w-full rounded-lg border border-white/10 bg-mc-accent px-3 text-base'
const label = 'mb-1 block text-sm text-mc-text/70'

export default function TerritoryReport({ formUrl }: { formUrl: string }) {
  const [options, setOptions] = useState<Options | null>(null)
  const [guestName, setGuestName] = useState('')
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
  const [doNotVisit, setDoNotVisit] = useState('')
  const [verdicts, setVerdicts] = useState<Record<number, Verdict>>({})
  const [reviewing, setReviewing] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const lock = useRef(false)

  async function load() {
    setError('')
    try {
      const res = await fetch('/api/territory-reports', { cache: 'no-store' })
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
  const timeslot = slotChoice === OTHER ? customSlot.trim() : slotChoice
  const problem = startDate && endDate && startDate > endDate ? '結束日不能早於開始日'
    : options && endDate > options.today ? '結束日不能晚於今天'
    : ''
  // 每區送出後怎麼處理由伺服器判斷（ADR-0100）；姓名、區域或結束日一改就重新檢查
  const checkKey = JSON.stringify([tags, endDate, options?.guest ? guestName.trim() : ''])
  const checked = tags.every(no => verdicts[no])
  useEffect(() => {
    if (!options || !tags.length) { setVerdicts({}); return }
    setVerdicts({}); setReviewing(false)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/territory-reports/check', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetNos: tags, endDate, ...(options.guest ? { name: guestName } : {}) }) })
        const value = await res.json()
        if (!res.ok) throw new Error(value.error || '無法檢查區域')
        setVerdicts(Object.fromEntries((value.areas as Verdict[]).map(v => [v.sheetNo, v])))
      } catch (e) { if (!controller.signal.aborted) setAreaHint(e instanceof Error ? e.message : '無法檢查區域') }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkKey, Boolean(options)])
  const blocked = selected.filter(a => verdicts[a.sheetNo]?.action === 'blocked')
  const warned = selected.filter(a => !['return', 'blocked', 'self'].includes(verdicts[a.sheetNo]?.action || 'return'))
  function outcome(a: Area) {
    const v = verdicts[a.sheetNo]
    if (!v) return '檢查中…'
    if (a.holder && v.action === 'confirm') return `不是你領取的（${a.holder} 領取中），將交管理員確認`
    if (a.holder && v.action === 'proxy') return `不是你領取的（${a.holder} 領取中），將以 ${a.holder} 的名義代為回報並交回`
    return v.reason
  }
  const tone = (a: Area) => verdicts[a.sheetNo]?.action === 'blocked' ? 'bg-red-400/15 text-red-200 hover:bg-red-400/25'
    : warned.includes(a) ? 'bg-amber-400/15 text-amber-200 hover:bg-amber-400/25'
    : 'bg-blue-400/15 text-blue-200 hover:bg-blue-400/25'

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

  const ready = selected.length > 0 && checked && !blocked.length && !problem && Boolean(timeslot) && Boolean(startDate) && Boolean(endDate) && !(options?.guest && !guestName.trim())
  function review(event: React.FormEvent) {
    event.preventDefault()
    if (!ready) return
    setAgreed(false); setReviewing(true); setError(''); setNotice('')
  }
  async function submit() {
    if (lock.current || !ready || (warned.length && !agreed)) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const res = await fetch('/api/territory-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(options?.guest ? { name: guestName } : {}), sheetNos: tags, timeslot, startDate, endDate, note, confirmed: true, ...(tags.length === 1 && doNotVisit.trim() ? { doNotVisit } : {}) }) })
      const value = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(value.error || '回報未送出，請稍後再試')
      const pending: number[] = value.pending || []
      setNotice(`已送出 ${selected.length} 區的回報${value.returned?.length ? `，交回 ${value.returned.length} 張地圖` : ''}。${pending.length ? `${pending.join('、')} 號將由管理員確認後交回。` : ''}${tags.length === 1 && doNotVisit.trim() ? '拒絕拜訪地址已送管理員審核。' : ''}${value.warning || ''}`)
      setNote(''); setDoNotVisit(''); setStartDate(''); setTags([]); setAreaText(''); setReviewing(false)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '回報未送出'); setReviewing(false) } finally { lock.current = false; setBusy(false) }
  }

  const formLink = <a href={formUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-blue-300">改用 Google 表單<ExternalLink aria-hidden="true" className="h-4 w-4" /><span className="sr-only">（另開分頁）</span></a>
  return <form onSubmit={review} className="space-y-4 rounded-2xl border border-white/10 bg-mc-card p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">區域回報{options?.name && <span className="ml-2 text-sm font-normal text-mc-text/60">{options.name}</span>}</h2>{formLink}</div>
    {!options && !error && <p role="status" className="text-sm text-mc-text/50">正在讀取區域…</p>}
    {options?.guest && <p className="text-sm text-mc-text/60"><a href="/login?callbackUrl=%2Fbulletin%2Fterritory-report" className="text-blue-300 underline-offset-2 hover:underline">登入</a>後姓名與領取中的地圖會自動帶入。</p>}
    {options && <>
      {options.guest && <div><label htmlFor="report-name" className={label}>姓名</label><input id="report-name" required maxLength={30} autoComplete="name" value={guestName} onChange={e => setGuestName(e.target.value)} className={control} /></div>}
      <div>
        <label htmlFor="report-area" className={label}>區域</label>
        <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-mc-accent px-2 py-2">
          {selected.map(a => <button key={a.sheetNo} type="button" aria-label={`取消 ${a.label}`} onClick={() => setTags(current => current.filter(no => no !== a.sheetNo))} className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm ${tone(a)}`}>{a.label}<X aria-hidden="true" className="h-3.5 w-3.5" /></button>)}
          <input id="report-area" inputMode="numeric" enterKeyHint="done" placeholder={tags.length ? '' : '輸入區號後按 Enter'} value={areaText} onKeyDown={areaKey} onBlur={() => { if (areaText && addTag(Number(areaText))) setAreaText('') }} onChange={e => { setAreaHint(''); setAreaText(e.target.value.replace(/\D/g, '').slice(0, 3)) }} className="min-h-9 min-w-[8rem] flex-1 bg-transparent px-1 text-base outline-none" />
        </div>
        {areaHint && <p role="alert" className="mt-1 text-xs text-amber-300">{areaHint}</p>}
        {options.held.some(a => !tags.includes(a.sheetNo)) && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs text-mc-text/50">我領取的：</span>{options.held.filter(a => !tags.includes(a.sheetNo)).map(a => <button key={a.sheetNo} type="button" onClick={() => addTag(a.sheetNo)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-white/10 px-3 text-sm text-mc-text/80 hover:bg-white/5"><Plus aria-hidden="true" className="h-3.5 w-3.5" />{a.label}</button>)}</div>}
        {(blocked.length > 0 || warned.length > 0) && <ul className="mt-2 space-y-0.5 text-xs">{[...blocked, ...warned].map(a => <li key={a.sheetNo} className={verdicts[a.sheetNo]?.action === 'blocked' ? 'text-red-300' : 'text-amber-200'}>{a.label}：{outcome(a)}</li>)}</ul>}
        {blocked.length > 0 && <p role="alert" className="mt-1 text-xs text-red-300">請移除標紅的區域才能送出。</p>}
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
      {tags.length === 1 && <div><label htmlFor="report-dnv" className={label}>拒絕拜訪地址（選填）</label><input id="report-dnv" maxLength={100} placeholder="例如：加昌路279巷5號" value={doNotVisit} onChange={e => setDoNotVisit(e.target.value)} className={control} /><p className="mt-1 text-xs text-mc-text/60">住戶要求不要再拜訪時填寫，管理員確認後會加到這張地圖。</p></div>}
      {problem && <p role="alert" className="text-sm text-amber-300">{problem}</p>}
      {!reviewing && <button type="submit" disabled={busy || !ready} className="min-h-12 w-full rounded-lg bg-blue-500 px-4 text-base font-semibold text-white disabled:opacity-40">{selected.length && !checked ? '檢查區域中…' : '下一步：確認'}</button>}
      {reviewing && <section aria-labelledby="report-review-title" className="space-y-3 rounded-xl border border-white/10 bg-mc-accent p-4">
        <h3 id="report-review-title" className="font-semibold">確認回報內容</h3>
        <p className="text-sm text-mc-text/70">{options.guest ? guestName.trim() : options.name}・{timeslot}・{startDate} ～ {endDate}</p>
        <ul className="space-y-2 text-sm">{selected.map(a => <li key={a.sheetNo} className="flex gap-2"><strong className="shrink-0">{a.label}</strong><span className={warned.includes(a) ? 'text-amber-200' : 'text-mc-text/70'}>{outcome(a)}</span></li>)}</ul>
        {warned.length > 0 && <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
          <p className="flex gap-2"><AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{options.admin ? '以上標黃的地圖不是你領取的，或狀態需要注意。確定要以管理員身分送出嗎？' : '以上標黃的地圖不是你領取的。如果是回報錯號碼，請回去修改；確定是你傳道的，送出後由管理員確認再交回。'}</p>
          <label className="mt-3 flex min-h-11 items-center gap-2"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="h-5 w-5" />我確認這些地圖是我傳道的</label>
        </div>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => setReviewing(false)} className="min-h-12 rounded-lg bg-white/5 px-4 text-base text-mc-text/80 disabled:opacity-40">回去修改</button>
          <button type="button" disabled={busy || (warned.length > 0 && !agreed)} onClick={() => void submit()} className="min-h-12 rounded-lg bg-blue-500 px-4 text-base font-semibold text-white disabled:opacity-40">{busy ? '送出中…' : '確認送出'}</button>
        </div>
      </section>}
    </>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
  </form>
}
