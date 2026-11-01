'use client'

import { useEffect, useState } from 'react'
import ServiceDutyIcon from './ServiceDutyIcon'
import { serviceRoles, autoRoles, qualifies, conflictRoles, fillServiceVacancies, type Assignments, type ServicePersonData, type ServiceRole, type ServiceWeekData } from '@/lib/service-roster'

// 管理頁一覽表：每列一週、每欄一職務，格內直接選人，多週一起儲存（ADR-0079）。
export default function ServiceRosterGrid({ weeks, people, revision, today, busy, save, openWeek, onDirtyChange }: {
  weeks: ServiceWeekData[]; people: ServicePersonData[]; revision: number; today: string; busy: boolean
  save: (body: Record<string, unknown>) => Promise<unknown>; openWeek: (startDate: string) => void; onDirtyChange: (dirty: boolean) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, Assignments>>({})
  const [showPast, setShowPast] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => { setDrafts({}); setNotice('') }, [revision])
  const changed = weeks.filter(w => drafts[w.startDate] && !sameAssignments(drafts[w.startDate], w.assignments))
  useEffect(() => { onDirtyChange(changed.length > 0) }, [changed.length, onDirtyChange])

  const past = weeks.filter(w => w.endDate < today)
  const shown = showPast ? weeks : weeks.filter(w => w.endDate >= today)
  const current = (w: ServiceWeekData) => drafts[w.startDate] ?? w.assignments

  function choose(week: ServiceWeekData, role: ServiceRole, personId: string) {
    const person = people.find(p => p.id === personId)
    setDrafts(all => {
      const next = { ...(all[week.startDate] ?? week.assignments) }
      if (person) next[role] = { personId: person.id, name: person.name }
      else delete next[role]
      return { ...all, [week.startDate]: next }
    })
    setNotice('')
  }
  // 依週次先後補空缺，前面補上的人也算進後面週次的輪替紀錄。
  function autofill() {
    const history = weeks.map(w => ({ ...w, assignments: current(w) }))
    const next = { ...drafts }
    let filled = 0
    for (const week of history) {
      if (week.stopped || week.endDate < today) continue
      const result = fillServiceVacancies(week, people, history)
      if (!result.filled) continue
      week.assignments = result.assignments
      next[week.startDate] = result.assignments
      filled += result.filled
    }
    setDrafts(next)
    setNotice(filled ? `已補 ${filled} 格（藍框），儲存後才發布。` : '本週起沒有可自動補的空缺。')
  }
  function submit() {
    void save({ action: 'weeks', weeks: changed.map(w => ({ startDate: w.startDate, note: w.note, stopped: w.stopped, assignments: drafts[w.startDate] })) }).catch(() => {})
  }

  return <section aria-labelledby="roster-grid-title" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="roster-grid-title" className="text-lg font-semibold">一覽表 <span className="text-base font-normal text-mc-text/60">{shown.length} 週 · 可左右滑動</span></h2>
      <div className="flex flex-wrap gap-2">
        {past.length > 0 && <button type="button" className={button} onClick={() => setShowPast(value => !value)}>{showPast ? '隱藏過去週次' : `顯示過去 ${past.length} 週`}</button>}
        <button type="button" className={button} disabled={busy} title={`本週起的${autoRoles.map(r => serviceRoles.find(role => role.id === r)!.label).join('、')}空缺`} onClick={autofill}>自動補空缺</button>
      </div>
    </div>
    {notice && <p role="status" className="text-base text-blue-300">{notice}</p>}
    <div role="region" aria-label="服務安排一覽表" tabIndex={0} className="max-h-[70vh] max-w-full overflow-auto rounded-xl border border-white/10">
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">每列一週、每欄一項工作，選單可直接改人選</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 top-0 z-30 min-w-24 border-b border-r border-white/10 bg-mc-card px-2 py-2 text-base">週次</th>
            {serviceRoles.map(role => <th key={role.id} scope="col" data-roster-group={role.group} className="sticky top-0 z-20 min-w-32 border-b border-r border-white/10 bg-mc-card p-1.5 last:border-r-0">
              <span className="roster-duty-title flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-base font-bold"><ServiceDutyIcon role={role.id} /><span>{role.label}</span></span>
            </th>)}
          </tr>
        </thead>
        <tbody>{shown.map(week => {
          const assignments = current(week)
          const conflicts = conflictRoles(assignments)
          const thisWeek = week.startDate <= today && week.endDate >= today
          const usedBy = new Map(Object.entries(assignments).filter(([role]) => role !== 'backup').map(([role, a]) => [a!.personId, role as ServiceRole]))
          return <tr key={week.startDate} className={`group ${week.endDate < today ? 'opacity-70' : ''}`}>
            <th scope="row" className={`sticky left-0 z-10 border-b border-r border-white/10 px-2 py-1.5 align-middle text-base font-semibold ${thisWeek ? 'bg-mc-accent' : 'bg-mc-card'}`}>
              <button type="button" title="開啟單週編輯（停排、備註）" className="text-left underline-offset-4 hover:underline" onClick={() => openWeek(week.startDate)}>
                <span className="block text-xs font-normal text-mc-text/60">{week.startDate.slice(0, 4)}{thisWeek ? ' · 本週' : ''}</span>
                <time dateTime={week.startDate}>{week.startDate.slice(5).replace('-', '/')}</time>
              </button>
            </th>
            {week.stopped ? <td colSpan={serviceRoles.length} className="border-b border-white/10 bg-mc-card px-3 py-2 text-base text-mc-text/70">停排{week.note ? `：${week.note}` : ''}</td> : serviceRoles.map(role => {
              const assigned = assignments[role.id]
              const eligible = people.filter(p => p.enabled && qualifies(p, role.id, people))
              const edited = (assigned?.personId ?? '') !== (week.assignments[role.id]?.personId ?? '')
              const warn = conflicts.has(role.id) || Boolean(assigned && !eligible.some(p => p.id === assigned.personId))
              return <td key={role.id} className="border-b border-r border-white/10 bg-mc-card p-1 last:border-r-0">
                <select aria-label={`${week.startDate} ${role.label}`} disabled={busy} value={assigned?.personId ?? ''} onChange={event => choose(week, role.id, event.target.value)}
                  className={`min-h-11 w-full rounded-md border px-1.5 text-base ${warn ? 'border-amber-300 text-amber-200' : edited ? 'border-blue-400 ring-1 ring-blue-400' : 'border-white/10'} ${assigned ? '' : 'text-mc-text/50'}`}>
                  <option value="">—</option>
                  {assigned && !eligible.some(p => p.id === assigned.personId) && <option value={assigned.personId}>{assigned.name}（資格待確認）</option>}
                  {eligible.map(p => { const other = usedBy.get(p.id); return <option key={p.id} value={p.id}>{p.name}{other && other !== role.id && role.id !== 'backup' ? `（已排${serviceRoles.find(r => r.id === other)!.label}）` : ''}</option> })}
                </select>
              </td>
            })}
          </tr>
        })}</tbody>
      </table>
    </div>
    <p className="text-sm text-mc-text/60">藍框為尚未儲存的修改，黃字為兼任重複或資格待確認。點日期可設定停排與備註。</p>
    {changed.length > 0 && <div className="sticky bottom-3 z-40 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-400/40 bg-mc-card p-3 shadow-lg">
      <span className="text-base">{changed.length} 週有修改，尚未發布</span>
      <div className="flex gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => { setDrafts({}); setNotice('') }}>捨棄</button>
        <button type="button" className="min-h-12 rounded-lg bg-blue-500 px-4 text-base text-white disabled:opacity-40" disabled={busy} onClick={submit}>{busy ? '處理中…' : '儲存並發布'}</button>
      </div>
    </div>}
  </section>
}

const button = 'min-h-12 rounded-lg border border-white/10 px-3 text-base hover:bg-mc-accent disabled:opacity-40'
function sameAssignments(a: Assignments, b: Assignments) {
  return serviceRoles.every(role => (a[role.id]?.personId ?? '') === (b[role.id]?.personId ?? ''))
}
