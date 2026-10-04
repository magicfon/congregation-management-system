'use client'

import { useEffect, useState } from 'react'
import { dateDay, serviceRoles, type ServiceRole, type ServiceWeekData } from '@/lib/service-roster'
import { overviewWeeks, overviewTabs } from '@/lib/service-roster-overview'
import ServiceDutyIcon from './ServiceDutyIcon'
import RosterName from './RosterName'
import useRosterIdentity from './useRosterIdentity'

type Snapshot = { initialized: boolean; weeks: ServiceWeekData[] }

export default function ServiceRosterOverview() {
  const { personId: ownPersonId, signedIn } = useRosterIdentity()
  const [tab, setTab] = useState('microphones')
  const [data, setData] = useState<Snapshot | null>(null)
  const [personId, setPersonId] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const today = dateDay(new Date())
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    void fetch('/api/service-roster', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('安排暫時無法讀取')
      const snapshot: Snapshot = await response.json()
      if (!controller.signal.aborted) setData(snapshot)
    }).catch(() => { if (!controller.signal.aborted) setError('安排暫時無法讀取，請重試。') })
    return () => controller.abort()
  }, [reload])

  const names = new Map<string, string>()
  for (const week of data?.weeks ?? []) if (!week.stopped) for (const role of serviceRoles) {
    const assigned = week.assignments[role.id]
    if (assigned) names.set(assigned.personId, assigned.name)
  }
  const activeTab = tab === 'mine' && !signedIn ? 'microphones' : tab
  const mine = activeTab === 'mine'
  const selectedTab = overviewTabs.find(item => item.id === activeTab) ?? overviewTabs[0]
  const roles = mine ? serviceRoles.map(role => role.id) : selectedTab.roles
  const filterPerson = mine ? ownPersonId ?? '' : personId
  const { upcoming, past } = overviewWeeks(mine && !ownPersonId ? [] : data?.weeks ?? [], today, filterPerson, roles)
  function chooseTab(value: string) { setTab(value); setPersonId('') }


  return <div className="space-y-5">
    {error ? <div role="alert" className="rounded-xl border border-white/10 p-4 text-lg">{error}<button type="button" onClick={() => setReload(value => value + 1)} className="ml-3 min-h-12 rounded-lg border border-white/10 px-3">重試</button></div> : !data ? <p role="status" className="text-lg">正在載入安排…</p> : !data.initialized ? <p className="text-lg">尚未公布安排。</p> : <>
      <nav aria-label="職務標籤" className="flex flex-wrap gap-1">
        {signedIn && <button type="button" aria-pressed={mine} data-roster-group="我的委派" onClick={() => chooseTab('mine')} className="roster-tab">我的委派</button>}
        {overviewTabs.map(item => <button key={item.id} type="button" aria-pressed={activeTab === item.id} data-roster-group={item.id === 'all' ? undefined : serviceRoles.find(role => role.id === item.roles[0])?.group} onClick={() => chooseTab(item.id)} className="roster-tab">{item.label}</button>)}
      </nav>
      {!mine && <details className="rounded-xl border border-white/10 bg-mc-card p-4">
        <summary className="cursor-pointer text-lg">依姓名篩選{personId ? `：${names.get(personId) ?? ''}` : ''}</summary>
        <div className="mt-3">
        <label htmlFor="roster-person" className="mb-2 block text-lg font-semibold">查看誰的安排</label>
        <div className="flex flex-wrap items-center gap-2">
          <select id="roster-person" value={personId} onChange={event => setPersonId(event.target.value)} className="min-h-12 min-w-0 flex-1 rounded-lg border border-white/10 px-3 text-xl">
            <option value="">所有人</option>
            {[...names].sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant')).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {personId && <button type="button" onClick={() => setPersonId('')} className="min-h-12 rounded-lg border border-white/10 px-3 text-base">顯示全部</button>}
        </div>
        </div>
      </details>}
      <section aria-labelledby="upcoming-title" className="space-y-4">
        <h2 id="upcoming-title" className="text-xl font-semibold">{mine ? '我的委派' : selectedTab.label} <span className="text-base font-normal text-mc-text/70">本週起 · {upcoming.length} 週</span></h2>
        {upcoming.length ? <WeeksTable weeks={upcoming} personId={filterPerson} today={today} ownPersonId={ownPersonId} roles={roles} label="本週與未來安排" /> : <p role="status" className="rounded-xl border border-white/10 bg-mc-card p-5 text-lg">{mine && !ownPersonId ? '帳號尚未對應排班名單，請管理員確認人員資格中的成員連結。' : filterPerson ? '目前公布的本週與未來安排中，沒有符合的委派。' : '尚未公布本週與未來安排。'}</p>}
      </section>
      <details className="rounded-xl border border-white/10 p-4">
        <summary className="min-h-12 cursor-pointer py-2 text-lg font-semibold">過去安排（{past.length} 週）</summary>
        <div className="mt-3 space-y-4">{past.length ? <WeeksTable weeks={past} personId={filterPerson} today={today} ownPersonId={ownPersonId} roles={roles} label="過去安排" /> : <p className="text-lg text-mc-text/70">沒有過去安排。</p>}</div>
      </details>
    </>}
  </div>
}

function WeeksTable({ weeks, personId, today, ownPersonId, roles, label }: { weeks: ServiceWeekData[]; personId: string; today: string; ownPersonId: string | null; roles: ServiceRole[]; label: string }) {
  const columns = serviceRoles.filter(role => roles.includes(role.id) && (!personId || weeks.some(week => !week.stopped && week.assignments[role.id]?.personId === personId)))
  return <div className="min-w-0">
    {columns.length > 1 && <p className="mb-2 text-base text-mc-text/70">可左右滑動查看工作</p>}
    <div role="region" aria-label={label} tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">{label}，每列一週、每欄一項工作</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 min-w-32 border-b border-r border-white/10 bg-mc-card px-3 py-3 text-lg">週次</th>
            {columns.map(role => <th key={role.id} scope="col" data-roster-group={role.group} className="min-w-32 border-b border-r border-white/10 bg-mc-card p-2 last:border-r-0">
              <span className="roster-duty-title flex items-center gap-1.5 rounded px-2 py-2 text-xl font-bold leading-7"><ServiceDutyIcon role={role.id} /><span>{role.label}</span></span>
            </th>)}
          </tr>
        </thead>
        <tbody>{weeks.map(week => {
          const current = week.startDate <= today && week.endDate >= today
          return <tr key={week.startDate} className="group bg-mc-card even:bg-mc-accent/20">
            <th scope="row" className="sticky left-0 z-10 w-32 min-w-32 border-b border-r border-white/10 bg-mc-card px-3 py-3 align-top text-lg font-semibold leading-7 group-last:border-b-0">
              <span className="block text-base font-normal text-mc-text/70">{week.startDate.slice(0, 4)}</span>
              <time dateTime={week.startDate}>{week.startDate.slice(5).replace('-', '/')}</time>
              <span className="block">～<time dateTime={week.endDate}>{week.endDate.slice(0, 4) === week.startDate.slice(0, 4) ? week.endDate.slice(5).replace('-', '/') : week.endDate.replaceAll('-', '/')}</time></span>
              {current && <span className="mt-1 inline-block rounded bg-blue-400/10 px-2 text-base">本週</span>}
              {!week.stopped && week.note && <p className="mt-2 max-w-40 whitespace-normal break-words text-base font-normal">{week.note}</p>}
            </th>
            {week.stopped ? <td colSpan={Math.max(1, columns.length)} className="border-b border-white/10 px-3 py-3 text-lg font-semibold group-last:border-b-0">本週停排{week.note ? `：${week.note}` : ''}</td> : columns.map(role => {
              const assignment = week.assignments[role.id]
              const hidden = personId && assignment?.personId !== personId
              return <td key={role.id} className="border-b border-r border-white/10 px-3 py-3 align-top text-2xl font-semibold leading-9 last:border-r-0 group-last:border-b-0">
                {hidden ? <span aria-label="無此人的委派" className="text-mc-text/40">—</span> : <RosterName assignment={assignment} ownPersonId={ownPersonId} />}
              </td>
            })}
          </tr>
        })}</tbody>
      </table>
    </div>
  </div>
}
