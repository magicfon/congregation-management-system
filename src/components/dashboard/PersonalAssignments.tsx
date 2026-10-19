'use client'

import { useState } from 'react'
import { ArrowUpRight, CalendarDays, ChevronDown } from 'lucide-react'
import type { AssignmentKind, PersonalAssignment, PersonalAssignments } from '@/lib/personal-assignments'

function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

function dateKey(item: PersonalAssignment) { return `${item.date}:${item.endDate}` }

function AssignmentList({ items }: { items: PersonalAssignment[] }) {
  const groups = new Map<string, PersonalAssignment[]>()
  for (const item of items) groups.set(dateKey(item), [...(groups.get(dateKey(item)) || []), item])
  return <div className="divide-y divide-white/10">{Array.from(groups, ([key, group]) => {
    const first = group[0]
    return <div key={key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 py-5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-6">
      <div className="pt-2 tabular-nums">
        <p className="text-xs text-mc-text/70">{first.date.slice(0, 4)}</p>
        <time dateTime={first.date} className="mt-1 block text-xl font-semibold tracking-tight">{shortDate(first.date)}</time>
        {first.endDate !== first.date && <p className="mt-1 text-xs text-mc-text/70">至 <time dateTime={first.endDate}>{first.endDate.slice(0, 4) !== first.date.slice(0, 4) ? first.endDate : shortDate(first.endDate)}</time></p>}
      </div>
      <div className="min-w-0"><p className="px-3 text-xs text-mc-text/70">{[...new Set(group.map(item => item.category))].join(' · ')}</p><ul className="mt-1 space-y-1">{group.map(item => <li key={item.id}>
        <a href={item.href} className="group flex min-h-14 items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300">
          <div className="min-w-0"><p className="break-words text-base font-medium leading-relaxed">{item.title}</p>{item.role && <p className="mt-0.5 text-sm text-blue-200">{item.role}</p>}</div>
          <ArrowUpRight size={16} aria-hidden="true" className="shrink-0 text-mc-text/70 group-hover:text-blue-200" />
        </a>
      </li>)}</ul></div>
    </div>
  })}</div>
}

export default function PersonalAssignmentsPanel({ data, kind = 'service' }: { data: PersonalAssignments; kind?: AssignmentKind }) {
  const [selectedKind, setSelectedKind] = useState(kind)
  kind = data.showBrotherService ? selectedKind : 'program'
  const upcoming = data.upcoming.filter(item => item.kind === kind)
  const past = data.past.filter(item => item.kind === kind)
  const dates = [...new Set(upcoming.map(dateKey))]
  const firstDates = new Set(dates.slice(0, 3))
  const initial = upcoming.filter(item => firstDates.has(dateKey(item)))
  const remaining = upcoming.filter(item => !firstDates.has(dateKey(item)))
  return <section id="assignments" data-dashboard-section="assignments" className="dashboard-section scroll-mt-20">
    <header className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">我的委派</h2><span className="text-sm text-mc-text/70">本週起 · {upcoming.length} 項</span></header>
    {data.showBrotherService && <nav aria-label="我的委派分類" className="mt-5 flex gap-6 border-b border-white/10">{([['service', '弟兄服務'], ['program', '節目委派']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setSelectedKind(value)} aria-pressed={kind === value} className={`flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 ${kind === value ? 'border-blue-300 text-blue-200' : 'border-transparent text-mc-text/70 hover:text-mc-text'}`}>{label}<span className="tabular-nums">{data.upcoming.filter(item => item.kind === value).length}</span></button>)}</nav>}
    {data.notices.length > 0 && <details className="mt-4 text-sm text-amber-200"><summary className="min-h-11 cursor-pointer py-3">有 {data.notices.length} 項資料需要確認</summary><div className="space-y-2 pb-3 leading-relaxed">{data.notices.map(notice => <p key={notice}>{notice}</p>)}</div></details>}
    {upcoming.length ? <AssignmentList items={initial} /> : <div className="my-5 flex items-center gap-3 rounded-xl bg-mc-card p-5 text-sm text-mc-text/70"><CalendarDays size={20} aria-hidden="true" /><p>本週起暫無已公布委派</p></div>}
    {remaining.length > 0 && <details className="group border-t border-white/10"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm text-blue-200 [&::-webkit-details-marker]:hidden">更多委派 · {remaining.length} 項<ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" /></summary><AssignmentList items={remaining} /></details>}
    <details className="group border-t border-white/10"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm text-mc-text/70 [&::-webkit-details-marker]:hidden">過去委派 · {past.length} 項<ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" /></summary>
      {past.length ? <AssignmentList items={past} /> : <p className="py-4 text-sm text-mc-text/70">尚無過去紀錄</p>}
    </details>
  </section>
}
