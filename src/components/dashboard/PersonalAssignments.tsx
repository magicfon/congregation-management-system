'use client'

import { ArrowUpRight, CalendarDays, ChevronDown } from 'lucide-react'
import type { PersonalAssignment, PersonalAssignments } from '@/lib/personal-assignments'

function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

function dateKey(item: PersonalAssignment) { return `${item.date}:${item.endDate}` }

function AssignmentList({ items, emphasize = false }: { items: PersonalAssignment[]; emphasize?: boolean }) {
  const groups = new Map<string, PersonalAssignment[]>()
  for (const item of items) groups.set(dateKey(item), [...(groups.get(dateKey(item)) || []), item])
  return <div className="divide-y divide-white/10">{Array.from(groups, ([key, group]) => {
    const first = group[0]
    return <div key={key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 py-5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-6">
      <div className="pt-2 tabular-nums">
        <p className="text-xs text-mc-text/70">{first.date.slice(0, 4)}</p>
        <time dateTime={first.date} className={`mt-1 block tracking-tight ${emphasize ? 'text-2xl font-bold text-blue-100' : 'text-xl font-semibold'}`}>{shortDate(first.date)}</time>
        {first.endDate !== first.date && (emphasize ? <p className="mt-1 text-xs text-blue-200/80">至 <time dateTime={first.endDate} className={`mt-0.5 block font-bold tracking-tight text-blue-100 ${first.endDate.slice(0, 4) !== first.date.slice(0, 4) ? 'text-base' : 'text-2xl'}`}>{first.endDate.slice(0, 4) !== first.date.slice(0, 4) ? first.endDate : shortDate(first.endDate)}</time></p> : <p className="mt-1 text-xs text-mc-text/70">至 <time dateTime={first.endDate}>{first.endDate.slice(0, 4) !== first.date.slice(0, 4) ? first.endDate : shortDate(first.endDate)}</time></p>)}
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

export default function PersonalAssignmentsPanel({ data }: { data: PersonalAssignments }) {
  const { upcoming } = data
  const inThisWeek = (item: PersonalAssignment) => item.date <= data.weekEnd && item.endDate >= data.weekStart
  const thisWeek = upcoming.filter(inThisWeek)
  const later = upcoming.filter(item => !inThisWeek(item))
  const dates = [...new Set(later.map(dateKey))]
  const firstDates = new Set(dates.slice(0, 3))
  const initial = later.filter(item => firstDates.has(dateKey(item)))
  const remaining = later.filter(item => !firstDates.has(dateKey(item)))
  return <section id="assignments" data-dashboard-section="assignments" className="dashboard-section scroll-mt-20">
    <header className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">我的委派</h2><span className="text-sm text-mc-text/70">本週起 · {upcoming.length} 項</span></header>
    {data.notices.length > 0 && <details className="mt-4 text-sm text-amber-200"><summary className="min-h-11 cursor-pointer py-3">有 {data.notices.length} 項資料需要確認</summary><div className="space-y-2 pb-3 leading-relaxed">{data.notices.map(notice => <p key={notice}>{notice}</p>)}</div></details>}
    <div data-assignments-week="this" className="mt-5 rounded-xl border-2 border-blue-300/70 bg-blue-400/10 px-4 pt-4 sm:px-5">
      <h3 className="flex flex-wrap items-baseline gap-2 text-lg font-semibold text-blue-100">本週委派<span className="text-sm font-normal tabular-nums text-blue-200/80">{shortDate(data.weekStart)}–{shortDate(data.weekEnd)}</span></h3>
      {thisWeek.length ? <AssignmentList items={thisWeek} emphasize /> : <div className="flex items-center gap-3 py-5 text-base font-medium text-blue-100"><CalendarDays size={20} aria-hidden="true" /><p>本週沒有委派</p></div>}
    </div>
    <div data-assignments-week="later" className="pt-6">
      <h3 className="text-sm font-medium text-mc-text/70">接下來</h3>
      {later.length ? <AssignmentList items={initial} /> : <p className="py-4 text-sm text-mc-text/70">暫無已公布委派</p>}
    </div>
    {remaining.length > 0 && <details className="group border-t border-white/10"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm text-blue-200 [&::-webkit-details-marker]:hidden">更多委派 · {remaining.length} 項<ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" /></summary><AssignmentList items={remaining} /></details>}
  </section>
}
