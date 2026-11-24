'use client'
import { useEffect, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import type { NoticeOverviewWeek, NoticePlanRow } from '@/lib/student-notice'
import { displayDate } from '@/lib/student-notice-text'

// 管理員看板「學生通知單」：先列出還沒按「收到」的學生，展開可逐張核對通知單內容（ADR-0146）。
function status(row: NoticePlanRow): [string, string] {
  if (row.confirmedAt) return ['已確認', 'bg-green-500/15 text-green-300']
  if (row.status === 'unchanged') return ['已發送，未確認', 'bg-amber-500/15 text-amber-300']
  if (row.status === 'new') return ['尚未發送', 'bg-blue-500/15 text-blue-300']
  if (row.status === 'updated') return ['內容已改，尚未重發', 'bg-blue-500/15 text-blue-300']
  if (row.status === 'unreachable') return ['需自行轉交', 'bg-amber-500/15 text-amber-300']
  return ['已換人，待通知取消', 'bg-red-500/15 text-red-300']
}
const unconfirmed = (row: NoticePlanRow) => row.status === 'unchanged' && !row.confirmedAt
const needsSend = (row: NoticePlanRow) => row.status === 'new' || row.status === 'updated' || row.status === 'unreachable' || row.status === 'cancel'
const confirmedTime = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

function Field({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-2"><dt className="w-10 shrink-0 text-mc-text/60">{label}</dt><dd className="min-w-0 break-words">{value || '—'}</dd></div>
}

export default function StudentNoticeStatus() {
  const [weeks, setWeeks] = useState<NoticeOverviewWeek[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/admin/student-notices', { cache: 'no-store', signal: controller.signal }).then(async res => {
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '讀取失敗')
      setWeeks(value.weeks)
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '讀取失敗') })
    return () => controller.abort()
  }, [])
  const all = weeks?.flatMap(week => week.rows.map(row => ({ week, row }))) ?? []
  const waiting = all.filter(({ row }) => unconfirmed(row))
  const pending = all.filter(({ row }) => needsSend(row))
  const confirmed = all.filter(({ row }) => row.confirmedAt).length
  return <section id="student-notices" aria-labelledby="student-notices-title" className="dashboard-section scroll-mt-20 space-y-3">
    <header className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id="student-notices-title" className="text-lg font-semibold">學生通知單{weeks && <span className="ml-2 text-sm font-normal text-mc-text/70">{waiting.length ? `${waiting.length} 人未確認` : all.length ? '已發送的都已確認' : ''}</span>}</h2>
      <a href="/midweek/manage" className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-200">週中編排<ArrowRight size={15} aria-hidden="true" /></a>
    </header>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!weeks && !error && <p role="status" className="text-sm text-mc-text/70">讀取中…</p>}
    {weeks && !all.length && <p className="py-2 text-sm text-mc-text/70">今天起已發布的週中聚會沒有學生作業。</p>}
    {weeks && !!all.length && <>
      <p className="text-sm text-mc-text/70">{[['已確認', confirmed], ['未確認', waiting.length], ['尚未發送或需處理', pending.length]].filter(([, n]) => n).map(([label, n]) => `${label} ${n}`).join('・')}</p>
      {!!waiting.length && <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-mc-card">{waiting.map(({ week, row }) => <li key={week.weekId + row.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
        <span className="font-medium">{row.name}</span><span className="text-mc-text/70">{displayDate(row.date)}・{row.title}</span>
      </li>)}</ul>}
      {!!pending.length && <p className="text-sm text-amber-200">另有 {pending.length} 張尚未發送、內容已改或需自行轉交，請到週中編排的「學生通知單」處理。</p>}
      <details className="group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-sm text-mc-text/70 [&::-webkit-details-marker]:hidden">核對每張通知單內容<ChevronDown size={16} aria-hidden="true" className="ml-auto transition-transform group-open:rotate-180" /></summary>
        <div className="space-y-5 py-3">{weeks.map(week => <div key={week.weekId} className="space-y-2">
          <h3 className="text-sm font-semibold">{displayDate(week.date)}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">{week.rows.map(row => {
            const [text, color] = status(row)
            return <li key={row.key} className="space-y-2 rounded-lg border border-white/10 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{text}</span>{row.confirmedAt && <span className="text-xs text-mc-text/60">{confirmedTime(row.confirmedAt)}</span>}{row.reason && <span className="text-xs text-mc-text/60">{row.reason}</span>}</div>
              {row.status === 'cancel' ? <p className="text-mc-text/80">{row.name}｜{row.title}</p> : <dl className="space-y-1">
                <Field label="姓名" value={row.name} /><Field label="助手" value={row.assistant} /><Field label="日期" value={displayDate(row.date)} /><Field label="節目" value={row.title} /><Field label="班別" value="第一班" />
              </dl>}
            </li>
          })}</ul>
        </div>)}</div>
      </details>
    </>}
  </section>
}
