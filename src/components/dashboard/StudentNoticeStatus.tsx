'use client'
import { useEffect, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import type { NoticeOverviewWeek, NoticePlanRow } from '@/lib/student-notice'
import { displayDate } from '@/lib/student-notice-text'

// 管理員看板「學生通知單」：只列已發送未按「收到」與需自行轉交的學生（ADR-0146 修訂）。
// 預設收合，只顯示標題與人數，點開才看名單（2026-11-28）。
const unconfirmed = (row: NoticePlanRow) => row.status === 'unchanged' && !row.confirmedAt
const handOver = (row: NoticePlanRow) => row.status === 'unreachable'

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
  const rows = weeks?.flatMap(week => week.rows.filter(row => unconfirmed(row) || handOver(row)).map(row => ({ week, row }))) ?? []
  const waiting = rows.filter(({ row }) => unconfirmed(row)).length
  const manual = rows.length - waiting
  return <section id="student-notices" aria-labelledby="student-notices-title" className="dashboard-section scroll-mt-20">
    <details className="group">
    <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
      <h2 id="student-notices-title" className="text-lg font-semibold">學生通知單{weeks && !!rows.length && <span className="ml-2 text-sm font-normal text-mc-text/70">{[['未確認', waiting], ['需自行轉交', manual]].filter(([, n]) => n).map(([label, n]) => `${label} ${n}`).join('・')}</span>}</h2>
      <ChevronDown size={18} aria-hidden="true" className="ml-auto text-mc-text/60 transition-transform group-open:rotate-180" />
    </summary>
    <div className="space-y-3 pt-3">
    <a href="/midweek/manage" className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-200">週中編排<ArrowRight size={15} aria-hidden="true" /></a>
    {!weeks && !error && <p role="status" className="text-sm text-mc-text/70">讀取中…</p>}
    {weeks && !rows.length && <p className="py-2 text-sm text-mc-text/70">沒有未確認或需自行轉交的學生。</p>}
    {!!rows.length && <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-mc-card">{rows.map(({ week, row }) => <li key={week.weekId + row.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
      <span className="font-medium">{row.name}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${handOver(row) ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-500/15 text-mc-text/70'}`}>{handOver(row) ? `需自行轉交${row.reason ? `（${row.reason}）` : ''}` : '未確認'}</span>
      <span className="text-mc-text/70">{displayDate(row.date)}・{row.title}</span>
    </li>)}</ul>}
    </div>
    </details>
    {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
  </section>
}
