import { createHash } from 'crypto'
import { serviceRoles, type ServiceWeekData } from './service-roster'
import type { SourceWeek } from './service-roster-import'
export type SyncWeek = SourceWeek
export type RemoteWeek = { sheet: string; row: number; week: SyncWeek }
export type SyncConflict = { id: string; date: string; reason: string; local: SyncWeek | null; remote: RemoteWeek[] }
export type SyncStatus = { lastRun: string | null; pulled: number; pushed: number; conflicts: SyncConflict[]; errors: string[] }
export type SyncState = SyncStatus & { baseline: Record<string, SyncWeek> }
export type Resolution = { id: string; date: string; choice: string; revision: number }
export class SyncError extends Error {}
export const emptySyncState = (): SyncState => ({ baseline: {}, lastRun: null, pulled: 0, pushed: 0, conflicts: [], errors: [] })
export function normalized(week: SyncWeek): SyncWeek {
  return { startDate: week.startDate, endDate: week.endDate, stopped: week.stopped, note: week.note.trim(), names: Object.fromEntries(serviceRoles.flatMap(role => week.stopped || !week.names[role.id]?.trim() ? [] : [[role.id, week.names[role.id]!.trim()]])) }
}
export function fromLocal(week: ServiceWeekData): SyncWeek {
  return normalized({ ...week, names: Object.fromEntries(serviceRoles.flatMap(role => week.assignments[role.id] ? [[role.id, week.assignments[role.id]!.name]] : [])) })
}
export const sameWeek = (a: SyncWeek | null | undefined, b: SyncWeek | null | undefined) => JSON.stringify(a ? normalized(a) : null) === JSON.stringify(b ? normalized(b) : null)
export function planWeek(date: string, local: SyncWeek | null, remote: RemoteWeek[], base?: SyncWeek, resolution?: Resolution): { target?: SyncWeek; conflict?: SyncConflict } {
  const variants = remote.filter((item, i) => remote.findIndex(other => sameWeek(item.week, other.week)) === i)
  const changed = variants.filter(item => !sameWeek(item.week, base))
  const candidate = changed.length === 1 ? changed[0].week : variants.length === 1 ? variants[0].week : null
  let target: SyncWeek | undefined
  if (local && candidate && sameWeek(local, candidate)) target = local
  else if (!base && !local && candidate) target = candidate
  else if (!base && local && !remote.length) target = local
  else if (base && local && candidate && changed.length <= 1) {
    if (sameWeek(local, base)) target = candidate
    else if (sameWeek(candidate, base)) target = local
  }
  if (target) return { target }
  const reason = !remote.length ? 'Google 週次已移除；本站保留原安排' : !local ? '本站缺少週次' : variants.length > 1 && changed.length > 1 ? 'Schedule 與 History 安排不同' : !base ? '首次連接時兩邊安排不同' : '本站與 Google 都有修改'
  const conflict: SyncConflict = { id: createHash('sha256').update(JSON.stringify({ date, local, remote })).digest('hex'), date, reason, local, remote }
  if (resolution?.date === date) {
    if (resolution.id !== conflict.id) throw new SyncError('安排已變更，請重新同步並確認衝突')
    const chosen = resolution.choice === 'local' ? local : remote.find(item => item.sheet === resolution.choice)?.week
    if (!chosen) throw new SyncError('無法選取此版本')
    return { target: chosen }
  }
  return { conflict }
}
