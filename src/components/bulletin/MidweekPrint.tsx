'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isCancelled, newMeeting, type Meeting, type MeetingRecord, type SourceWeek } from '@/lib/midweek'
import { PrintSheet } from './MeetingSheet'
import type { ManagedWeek } from './MidweekWeek'

const button = 'min-h-11 rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40'
// 印公布欄上的版本；還沒發布的週印草稿。取消的週印「本週無聚會：原因」（ADR-0131、ADR-0132）。
export function printableMeeting(record: MeetingRecord | null, source: SourceWeek | null): { meeting: Meeting; draft: boolean } | null {
  if (record?.published) return { meeting: record.published, draft: false }
  if (record?.draft) return { meeting: record.draft, draft: true }
  return source ? { meeting: newMeeting(source), draft: true } : null
}
// 週中編排列印：選要印的週（預設目前顯示的那一週），一週一張 A4（ADR-0132）。
export default function MidweekPrint({ weeks, initial }: { weeks: ManagedWeek[]; initial: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false), [chosen, setChosen] = useState<string[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [pages, setPages] = useState<Meeting[] | null>(null)
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close() }, [open])
  useEffect(() => {
    if (!pages) return
    const done = () => { document.body.classList.remove('printing-midweek'); setPages(null) }
    document.body.classList.add('printing-midweek')
    window.addEventListener('afterprint', done, { once: true })
    const timer = window.setTimeout(() => window.print(), 50)
    return () => { window.clearTimeout(timer); window.removeEventListener('afterprint', done); document.body.classList.remove('printing-midweek') }
  }, [pages])
  function start() { setChosen(initial.filter(id => weeks.some(week => week.id === id))); setError(''); setOpen(true) }
  async function print() {
    setBusy(true); setError('')
    try {
      const ordered = weeks.filter(week => chosen.includes(week.id))
      const loaded = await Promise.all(ordered.map(async week => {
        const response = await fetch(`/api/midweek/manage?id=${week.id}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '讀取失敗')
        return printableMeeting(data.record, data.source)?.meeting
      }))
      setOpen(false); setPages(loaded.filter((meeting): meeting is Meeting => Boolean(meeting)))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const toggle = (id: string) => setChosen(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  return <>
    <button className={`${button} shrink-0 text-sm`} disabled={!weeks.length} onClick={start}>列印</button>
    <dialog ref={dialog} aria-label="列印節目表" onCancel={() => setOpen(false)} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-mc-bg p-5 text-mc-text shadow-2xl backdrop:bg-black/60 sm:p-6">
      <h2 className="mb-2 text-lg font-semibold">列印節目表</h2>
      <p className="mb-4 text-sm text-mc-text/70">印出公布欄上的版本，一週一張 A4；還沒發布的週印草稿。</p>
      <fieldset disabled={busy} className="space-y-1">
        <legend className="sr-only">要列印的週</legend>
        {weeks.map(week => <label key={week.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-white/5">
          <input type="checkbox" className="h-5 w-5" checked={chosen.includes(week.id)} onChange={() => toggle(week.id)} />
          <span>{week.date.replaceAll('-', '/')}　{week.reading}</span>
        </label>)}
      </fieldset>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 p-3 text-red-300">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button className={`${button} flex-1`} disabled={busy} onClick={() => setOpen(false)}>返回</button>
        <button className={`${button} flex-1 bg-blue-600 font-semibold text-white`} disabled={busy || !chosen.length} onClick={print}>{busy ? '準備中…' : `列印 ${chosen.length} 週`}</button>
      </div>
    </dialog>
    {pages && createPortal(<div className="midweek-print">{pages.map((meeting, index) => <div key={index} className="midweek-print-page" data-cancelled={isCancelled(meeting) || undefined}><PrintSheet meeting={meeting} /></div>)}</div>, document.body)}
  </>
}
