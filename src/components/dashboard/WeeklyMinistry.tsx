'use client'
import { CalendarDays } from 'lucide-react'
import { ministryWeek, type MinistryTask } from '../../lib/ministry-week'

export default function WeeklyMinistry({ today, tasks }: { today: string; tasks: MinistryTask[] }) {
  const { days, earlier, later } = ministryWeek(today, tasks)
  function taskLink(task: MinistryTask, showDate = false) {
    return <a key={task.id} href={`/map/ministry/${task.areaId}`} className="block rounded-lg border border-white/10 bg-white/5 p-2.5 hover:bg-white/10">
      {showDate && <span className="mb-1 block text-xs text-mc-text/50">{task.date}</span>}
      <strong className="block break-words text-sm">{task.label}</strong>
      <span className={`mt-1 block text-xs ${task.status==='active'?'text-blue-300':'text-mc-text/50'}`}>{task.status==='active'?'進行中 · 塗畫／回報 →':'待開始 · 等待交接'}</span>
    </a>
  }
  return <section id="week" className="scroll-mt-16 space-y-3 rounded-xl border border-blue-400/25 bg-mc-card p-4">
    <header className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><CalendarDays size={18} className="text-blue-300"/>本週行程</h2><span className="text-xs text-mc-text/50">{days[0].date} ～ {days[6].date} · 台北時間</span></header>
    {!!earlier.length && <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-3"><h3 className="mb-2 text-sm text-amber-300">先前尚未完成 · {earlier.length} 筆</h3><div className="grid gap-2 sm:grid-cols-2">{earlier.map(t=>taskLink(t,true))}</div></div>}
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">{days.map(day=><div key={day.date} className={`grid min-w-0 grid-cols-[82px_minmax(0,1fr)] items-start gap-2 rounded-lg border p-2 sm:block ${day.date===today?'border-blue-400/50 bg-blue-400/10':'border-white/5'}`}><h3 className="flex flex-wrap items-center justify-between gap-1 text-xs sm:mb-2"><span className={day.date===today?'text-blue-300':'text-mc-text/60'}>{day.label} · {day.date.slice(5).replace('-','/')}</span>{day.date===today&&<span className="text-blue-300">今天</span>}</h3><div className="space-y-2">{day.tasks.length?day.tasks.map(t=>taskLink(t)):<p className="py-1 text-xs text-mc-text/30">無安排</p>}</div></div>)}</div>
    {!!later.length&&<details><summary className="cursor-pointer text-sm text-mc-text/60">之後的安排（{later.length} 筆）</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{later.map(t=>taskLink(t,true))}</div></details>}
  </section>
}
