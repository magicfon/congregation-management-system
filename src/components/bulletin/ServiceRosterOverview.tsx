'use client'

import { useEffect, useState } from 'react'
import { dateDay, serviceRoles, type ServiceRole, type ServiceWeekData } from '@/lib/service-roster'
import { overviewWeeks, overviewDuties, overviewTabs } from '@/lib/service-roster-overview'
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
        {upcoming.length ? upcoming.map(week => <WeekCard key={week.startDate} week={week} personId={filterPerson} today={today} ownPersonId={ownPersonId} roles={roles} />) : <p role="status" className="rounded-xl border border-white/10 bg-mc-card p-5 text-lg">{mine && !ownPersonId ? '帳號尚未對應排班名單，請管理員確認人員資格中的成員連結。' : filterPerson ? '目前公布的本週與未來安排中，沒有符合的委派。' : '尚未公布本週與未來安排。'}</p>}
      </section>
      <details className="rounded-xl border border-white/10 p-4">
        <summary className="min-h-12 cursor-pointer py-2 text-lg font-semibold">過去安排（{past.length} 週）</summary>
        <div className="mt-3 space-y-4">{past.length ? past.map(week => <WeekCard key={week.startDate} week={week} personId={filterPerson} today={today} ownPersonId={ownPersonId} roles={roles} />) : <p className="text-lg text-mc-text/70">沒有過去安排。</p>}</div>
      </details>
    </>}
  </div>
}

function WeekCard({ week, personId, today, ownPersonId, roles }: { week: ServiceWeekData; personId: string; today: string; ownPersonId: string | null; roles: ServiceRole[] }) {
  const current = week.startDate <= today && week.endDate >= today
  return <article className="overflow-hidden rounded-2xl border border-white/10 bg-mc-card">
    <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-mc-accent/30 px-4 py-3">
      <h3 className="text-xl font-bold"><time dateTime={week.startDate}>{week.startDate.replaceAll('-', '/')}</time><span className="mx-1">～</span><time dateTime={week.endDate}>{week.endDate.slice(0, 4) === week.startDate.slice(0, 4) ? week.endDate.slice(5).replace('-', '/') : week.endDate.replaceAll('-', '/')}</time></h3>
      {current && <span className="rounded bg-blue-400/10 px-2 py-1 text-base font-semibold text-blue-300">本週</span>}
    </header>
    {week.stopped ? <p className="p-4 text-lg font-semibold">本週停排{week.note ? `：${week.note}` : ''}</p> : <>
      {week.note && <p className="px-4 pt-4 text-lg">{week.note}</p>}
      <dl className="grid grid-cols-1 gap-3 p-4 min-[380px]:grid-cols-2 lg:grid-cols-3">{overviewDuties(week, personId, roles).map(role => <div key={role.id} data-roster-group={role.group} className="min-w-0 py-1">
        <dt className="roster-duty-title mb-2 flex w-fit max-w-full items-start gap-1.5 rounded px-1 py-1 text-xl font-bold leading-7"><ServiceDutyIcon role={role.id} /><span>{role.label}</span></dt>
        <dd className="break-words text-2xl font-semibold leading-9"><RosterName assignment={week.assignments[role.id]} ownPersonId={ownPersonId} /></dd>
      </div>)}</dl>
    </>}
  </article>
}
