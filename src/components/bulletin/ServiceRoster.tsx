'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { serviceRoles, assignmentConflicts, addDays, dateDay, weekLabel, type ServicePersonData, type ServiceRole, type ServiceWeekData, type Assignments } from '@/lib/service-roster'
type Member = { id: string; name: string }
type Snapshot = { initialized: boolean; revision: number; weeks: ServiceWeekData[]; people?: ServicePersonData[]; members?: Member[] }
const button = 'min-h-11 rounded-lg border border-white/10 px-3 text-sm hover:bg-mc-accent disabled:opacity-40'
const control = 'min-h-11 w-full rounded-lg border border-white/10 px-3 text-sm'
const groups = ['招待', '週末聚會', '設備服務', '週中聚會']

export default function ServiceRoster() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [admin, setAdmin] = useState(false)
  const [selected, setSelected] = useState('')
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [draft, setDraft] = useState<Assignments>({})
  const [note, setNote] = useState('')
  const [stopped, setStopped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [createDate, setCreateDate] = useState('')
  const today = dateDay(new Date())
  const week = data?.weeks.find(w => w.startDate === selected)
  const weekIndex = data?.weeks.findIndex(w => w.startDate === selected) ?? -1
  const currentWeek = data?.weeks.find(w => w.startDate <= today && w.endDate >= today)

  function accept(next: Snapshot) {
    setData(next)
    setSelected(current => next.weeks.some(w => w.startDate === current) ? current : next.weeks.find(w => w.startDate <= today && w.endDate >= today)?.startDate ?? next.weeks.find(w => w.startDate > today)?.startDate ?? next.weeks.at(-1)?.startDate ?? '')
    setCreateDate(next.weeks.length ? addDays(next.weeks.at(-1)!.startDate, 7) : today)
  }
  async function load() {
    setError(''); setBusy(true)
    try {
      const response = await fetch('/api/service-roster', { cache: 'no-store' })
      if (!response.ok) throw new Error('服務安排暫時無法讀取')
      accept(await response.json())
      const me = await fetch('/api/me', { cache: 'no-store' })
      const isAdmin = me.ok && (await me.json()).isAdmin === true
      setAdmin(isAdmin)
      if (isAdmin) {
        const managed = await fetch('/api/service-roster/manage', { cache: 'no-store' })
        if (!managed.ok) throw new Error('管理資料暫時無法讀取')
        accept(await managed.json())
      }
      setEditing(false); setDirty(false)
    } catch (err) { setError(err instanceof Error ? err.message : '讀取失敗') }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => { setDraft(week?.assignments ?? {}); setNote(week?.note ?? ''); setStopped(week?.stopped ?? false); setDirty(false) }, [week])

  async function act(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/service-roster/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: data?.revision, ...body }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '操作失敗')
      if (body.action !== 'preview') { accept(result); setEditing(false); setDirty(false); setNotice('已儲存並發布') }
      return result
    } catch (err) { setError(err instanceof Error ? err.message : '操作失敗'); throw err }
    finally { setBusy(false) }
  }
  function changeWeek(value: string) {
    if (dirty && !window.confirm('捨棄尚未儲存的安排？')) return
    setSelected(value); setEditing(false); setNotice(''); setError('')
  }
  async function preview() {
    try {
      const result = await act({ action: 'preview', startDate: selected, assignments: draft, stopped })
      setDraft(result.assignments as Assignments); setDirty(true)
      setNotice(`已補 ${result.filled} 項，儲存後才發布。${(result.warnings as string[]).join('；')}`)
    } catch {}
  }
  const warnings = admin && week ? [
    ...assignmentConflicts(editing ? draft : week.assignments),
    ...Object.entries(editing ? draft : week.assignments).filter(([role, value]) => { const p = data?.people?.find(p => p.id === value!.personId); return !p?.enabled || !p.roles.includes(role as ServiceRole) }).map(([role, value]) => `${value!.name}的${serviceRoles.find(r => r.id === role)!.label}資格待確認`),
  ] : []

  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-xl border border-white/10 p-3 text-sm">{error}<button type="button" className={`${button} ml-2`} disabled={busy} onClick={() => void load()}>重新載入</button></p>}
    {notice && <p role="status" className="text-sm text-blue-300">{notice}</p>}
    {!data && !error && <p role="status" className="text-sm text-mc-text/60">正在載入安排…</p>}
    {data && !data.initialized && <div className="rounded-xl border border-white/10 p-4"><p className="text-sm">本站輪值資料尚未匯入。</p>{admin && <button type="button" className={`${button} mt-3`} disabled={busy} onClick={() => void act({ action: 'initialize' }).catch(() => {})}>{busy ? '匯入中…' : '首次匯入 Google 輪值資料'}</button>}</div>}
    {data?.initialized && <>
      <div className="rounded-2xl border border-white/10 bg-mc-card p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-blue-300">{currentWeek?.startDate === selected ? '本週安排' : '每週安排'}{dirty ? ' · 尚未儲存' : ''}</span>
          <div className="flex items-center gap-2">
            {currentWeek && currentWeek.startDate !== selected && <button type="button" className={button} disabled={busy} onClick={() => changeWeek(currentWeek.startDate)}>回本週</button>}
            {admin && week && <button type="button" className={button} disabled={busy} onClick={() => { setDraft(week.assignments); setNote(week.note); setStopped(week.stopped); setEditing(!editing); setDirty(false); setNotice('') }}>{editing ? '取消編輯' : '安排'}</button>}
          </div>
        </div>
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
          <button type="button" aria-label="上一週" className={`${button} flex items-center justify-center px-0`} disabled={busy || weekIndex <= 0} onClick={() => changeWeek(data.weeks[weekIndex - 1].startDate)}><ChevronLeft aria-hidden="true" className="h-5 w-5" /></button>
          <label className="min-w-0 text-center"><span className="sr-only">查看週次</span><select aria-label="查看週次" className={`${control} text-center font-semibold`} value={selected} disabled={busy} onChange={event => changeWeek(event.target.value)}>{data.weeks.map(w => <option key={w.startDate} value={w.startDate}>{w.startDate.slice(0, 4)} · {w.startDate.slice(5).replace('-', '/')}～{w.endDate.slice(0, 4) !== w.startDate.slice(0, 4) ? `${w.endDate.slice(0, 4)}/` : ''}{w.endDate.slice(5).replace('-', '/')}{w.stopped ? '（停排）' : ''}</option>)}</select></label>
          <button type="button" aria-label="下一週" className={`${button} flex items-center justify-center px-0`} disabled={busy || weekIndex < 0 || weekIndex >= data.weeks.length - 1} onClick={() => changeWeek(data.weeks[weekIndex + 1].startDate)}><ChevronRight aria-hidden="true" className="h-5 w-5" /></button>
        </div>
      </div>
      {week && <>
        <h2 className="sr-only">{weekLabel(week.startDate)} 服務安排</h2>
        {editing && <fieldset disabled={busy} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-mc-card p-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={stopped} onChange={event => { setStopped(event.target.checked); setDirty(true) }} />本週停排</label><label className="min-w-0 flex-1"><span className="sr-only">備註或停排原因</span><input type="text" aria-label="備註或停排原因" className={control} maxLength={300} placeholder="備註／停排原因" value={note} onChange={event => { setNote(event.target.value); setDirty(true) }} /></label></fieldset>}
        {(editing ? stopped : week.stopped) ? <p className="rounded-xl border border-white/10 bg-mc-card p-5 text-base">本週停排{(editing ? note : week.note) ? `：${editing ? note : week.note}` : ''}</p> : <>
          {!editing && week.note && <p className="text-sm text-mc-text/60">{week.note}</p>}
          <fieldset disabled={busy} className="grid items-start gap-3 md:grid-cols-2">
            {groups.map(group => <section key={group} data-roster-group={group} className="roster-group overflow-hidden rounded-xl border bg-mc-card"><h3 className="roster-group-title px-3 py-2 text-sm font-semibold">{group}</h3><dl className={editing ? 'space-y-2 p-3' : 'grid grid-cols-2 gap-x-3 gap-y-2 p-3'}>{serviceRoles.filter(r => r.group === group).map(role => {
              const assigned = (editing ? draft : week.assignments)[role.id]
              const eligible = data.people?.filter(p => p.enabled && p.memberId && p.roles.includes(role.id)) ?? []
              return <div key={role.id} className={editing ? 'grid min-h-11 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2' : 'min-w-0 py-1'}><dt className={editing ? 'text-sm text-mc-text/60' : 'mb-0.5 text-xs leading-5 text-mc-text/60'}>{role.label}</dt><dd>{editing ? <select className={control} aria-label={role.label} value={assigned?.personId ?? ''} onChange={event => { const person = data.people?.find(p => p.id === event.target.value); setDraft(current => { const next = { ...current }; if (person) next[role.id] = { personId: person.id, name: person.name }; else delete next[role.id]; return next }); setDirty(true) }}><option value="">待安排</option>{assigned && !eligible.some(p => p.id === assigned.personId) && <option value={assigned.personId}>{assigned.name}（原安排）</option>}{eligible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : <span className={`break-words text-lg leading-7 ${assigned ? 'font-semibold' : 'text-mc-text/40'}`}>{assigned?.name ?? '待安排'}</span>}</dd></div>
            })}</dl></section>)}
          </fieldset>
        </>}
        {editing && <div className="flex flex-wrap items-center gap-2"><button type="button" className={button} disabled={busy || stopped} onClick={() => void preview()}>自動補空缺</button><button type="button" className="min-h-11 rounded-lg bg-blue-500 px-4 text-sm text-white disabled:opacity-40" disabled={busy || !dirty} onClick={() => void act({ action: 'week', startDate: selected, note, stopped, assignments: draft }).catch(() => {})}>{busy ? '處理中…' : '儲存並發布'}</button></div>}
        {admin && warnings.length > 0 && <details className="text-sm text-mc-text/60"><summary className="cursor-pointer py-2">{warnings.length} 項資格／兼任提醒</summary><ul className="space-y-1 py-2">{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
      </>}
      {admin && !editing && <>
        <details className="rounded-xl border border-white/10 bg-mc-card p-4"><summary className="cursor-pointer text-sm font-semibold">新增週次</summary><form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); void act({ action: 'create', startDate: createDate, note: '', stopped: false, assignments: {} }).then(() => setSelected(createDate)).catch(() => {}) }}><label className="flex-1 text-sm">週開始（星期一）<input type="date" required className={`${control} mt-2`} value={createDate} disabled={busy} onChange={event => setCreateDate(event.target.value)} /></label><button className={`${button} mt-7`} disabled={busy}>新增</button></form></details>
        <PersonEditor people={data.people ?? []} members={data.members ?? []} busy={busy} save={act} />
      </>}
      <RosterStats data={data} />
    </>}
  </div>
}

function PersonEditor({ people, members, busy, save }: { people: ServicePersonData[]; members: Member[]; busy: boolean; save: (body: Record<string, unknown>) => Promise<unknown> }) {
  const [id, setId] = useState('new'), [memberId, setMemberId] = useState(''), [roles, setRoles] = useState<ServiceRole[]>([]), [enabled, setEnabled] = useState(true)
  useEffect(() => { const person = people.find(p => p.id === id); setMemberId(person?.memberId ?? ''); setRoles(person?.roles ?? []); setEnabled(person?.enabled ?? true) }, [id, people])
  const pending = people.filter(p => !p.memberId).length
  return <details className="rounded-xl border border-white/10 bg-mc-card p-4"><summary className="cursor-pointer text-sm font-semibold">人員資格{pending ? ` · ${pending} 人待對應` : ''}</summary><form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void save({ action: 'person', id: id === 'new' ? null : id, memberId, roles, enabled }).catch(() => {}) }}><fieldset disabled={busy} className="space-y-3">
    <label className="block text-sm">人員<select className={`${control} mt-2`} value={id} onChange={event => setId(event.target.value)}><option value="new">新增成員</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}{!p.memberId ? '（待對應）' : !p.enabled ? '（停用）' : ''}</option>)}</select></label>
    <label className="block text-sm">對應成員<select required className={`${control} mt-2`} value={memberId} onChange={event => setMemberId(event.target.value)}><option value="">選擇啟用成員</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />可安排</label>
    <div className="grid grid-cols-2 gap-2">{serviceRoles.map(role => <label key={role.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={roles.includes(role.id)} onChange={event => setRoles(current => event.target.checked ? [...current, role.id] : current.filter(r => r !== role.id))} />{role.label}</label>)}</div>
    <button className={button}>儲存資格</button>
  </fieldset></form></details>
}

function RosterStats({ data }: { data: Snapshot }) {
  const people = new Map<string, { name: string; duties: { role: ServiceRole; date: string }[] }>()
  for (const p of data.people ?? []) if (p.enabled) people.set(p.id, { name: p.name, duties: [] })
  for (const week of data.weeks) if (!week.stopped) for (const [role, assignment] of Object.entries(week.assignments)) {
    if (role === 'backup') continue
    const person = people.get(assignment!.personId) ?? { name: assignment!.name, duties: [] }
    person.duties.push({ role: role as ServiceRole, date: week.startDate }); people.set(assignment!.personId, person)
  }
  return <details className="rounded-xl border border-white/10 bg-mc-card p-4"><summary className="cursor-pointer text-sm font-semibold">安排統計</summary><p className="my-3 text-xs text-mc-text/60">含未來安排，不代表已完成勤務；替補招待不計次。</p><div className="max-h-96 space-y-3 overflow-auto">{[...people].sort(([, a], [, b]) => a.duties.length - b.duties.length).map(([id, p]) => <div key={id} className="border-t border-white/10 pt-3"><div className="flex items-center justify-between text-sm"><span className="font-medium">{p.name}</span><span>{p.duties.length} 次</span></div><div className="mt-2 flex flex-wrap gap-1">{data.weeks.filter(w => !w.stopped && p.duties.some(d => d.date === w.startDate)).map(w => <span key={w.startDate} className="rounded bg-mc-accent px-2 py-1 text-xs text-mc-text/70">{w.startDate.slice(5)} {p.duties.filter(d => d.date === w.startDate).map(d => serviceRoles.find(r => r.id === d.role)!.label).join('、')}</span>)}</div></div>)}</div></details>
}
