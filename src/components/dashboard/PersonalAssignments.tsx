import Link from 'next/link'
import type { AssignmentKind, PersonalAssignment, PersonalAssignments } from '@/lib/personal-assignments'

function AssignmentList({ items }: { items: PersonalAssignment[] }) {
  return <ul className="divide-y divide-white/10">{items.map(item => <li key={item.id}>
    <a href={item.href} className="block rounded-lg py-3 hover:bg-white/5 focus-visible:outline focus-visible:outline-2">
      <p className="text-sm text-mc-text/60"><time dateTime={item.date}>{item.date}</time>{item.endDate !== item.date && ` ～ ${item.endDate}`} · {item.category}</p>
      <p className="mt-1 font-medium">{item.title}{item.role && <span className="ml-2 text-blue-300">{item.role}</span>}</p>
    </a>
  </li>)}</ul>
}

export default function PersonalAssignmentsPanel({ data, kind = 'service' }: { data: PersonalAssignments; kind?: AssignmentKind }) {
  const upcoming = data.upcoming.filter(item => item.kind === kind)
  const past = data.past.filter(item => item.kind === kind)
  return <section id="assignments" className="scroll-mt-16 rounded-xl border border-white/10 bg-mc-card p-4">
    <h2 className="font-semibold">我的委派 <span className="text-sm font-normal text-mc-text/60">本週起 · {upcoming.length} 項</span></h2>
    <nav aria-label="我的委派分類" className="my-4 grid grid-cols-2 gap-2">{([['service', '弟兄服務'], ['program', '節目委派']] as const).map(([value, label]) => <Link key={value} href={`/dashboard/assignments/${value}`} aria-current={kind === value ? 'page' : undefined} className={`rounded-lg border px-3 py-3 text-center font-medium ${kind === value ? 'border-blue-400/40 bg-blue-400/15 text-blue-200' : 'border-white/10 text-mc-text/70 hover:bg-white/5'}`}>{label} <span className="text-sm">{data.upcoming.filter(item => item.kind === value).length}</span></Link>)}</nav>
    {data.notices.map(notice => <p key={notice} className="mt-3 text-sm text-amber-300">{notice}</p>)}
    {upcoming.length ? <AssignmentList items={upcoming} /> : <p className="py-4 text-sm text-mc-text/60">目前沒有本週及未來已公布的委派。</p>}
    <details className="mt-2 border-t border-white/10 pt-3"><summary className="cursor-pointer text-sm text-mc-text/60">過去委派（{past.length} 項）</summary>
      {past.length ? <AssignmentList items={past} /> : <p className="py-3 text-sm text-mc-text/60">沒有過去委派。</p>}
    </details>
  </section>
}
