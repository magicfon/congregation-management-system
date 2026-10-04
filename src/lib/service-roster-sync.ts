import type { PrismaClient, Prisma } from '@prisma/client'
import { serviceRoles, validateAssignments, type Assignments, type ServicePersonData, type ServiceWeekData } from './service-roster'
import { readRosterSheet, writeRosterSheet } from './service-roster-sheet'
import { emptySyncState, fromLocal, planWeek, sameWeek, SyncError, type SyncState, type SyncStatus, type SyncWeek, type Resolution } from './service-roster-sync-plan'
const key = 'service_roster_sheet_sync_v1'
function decode(value?: string): SyncState { return value ? JSON.parse(value) : emptySyncState() }
export async function rosterSyncStatus(db: PrismaClient): Promise<SyncStatus> {
  const { baseline: _, ...status } = decode((await db.setting.findUnique({ where: { key } }))?.value)
  return status
}
export function importedAssignments(target: SyncWeek, previous: Assignments, people: ServicePersonData[]) {
  if (target.stopped) return previous
  const assignments: Assignments = {}
  for (const role of serviceRoles) {
    const name = target.names[role.id]
    if (!name) continue
    if (previous[role.id]?.name === name) { assignments[role.id] = previous[role.id]; continue }
    const matches = people.filter(person => person.name.trim() === name)
    if (matches.length !== 1) throw new SyncError(`${target.startDate}：${name}尚未唯一對應本站人員，請先設定人員資格`)
    assignments[role.id] = { personId: matches[0].id, name }
  }
  try { return validateAssignments(assignments, previous, people) }
  catch (error) { throw new SyncError(`${target.startDate}：${error instanceof Error ? error.message : '人員資格不符'}`) }
}
export async function syncServiceRoster(db: PrismaClient, resolution?: Resolution): Promise<SyncStatus> {
  try {
    return await db.$transaction(async tx => {
      const locks = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(74215, 2026) AS locked`
      if (!locks[0]?.locked) throw new SyncError('另一個同步正在進行，請稍後重試')
      const states = await tx.$queryRaw<{ revision: number }[]>`SELECT "revision" FROM "service_roster_state" WHERE "id" = 'main' FOR UPDATE`
      if (!states.length) throw new SyncError('請先匯入服務安排')
      if (resolution && states[0].revision !== resolution.revision) throw new SyncError('本站安排已更新，請重新載入後確認衝突')
      const state = decode((await tx.setting.findUnique({ where: { key } }))?.value)
      state.conflicts = []; state.errors = []; state.pulled = 0; state.pushed = 0
      try {
        const source = await readRosterSheet()
        const local = await tx.serviceWeek.findMany() as unknown as ServiceWeekData[]
        const members = await tx.member.findMany({ where: { active: true, deletedAt: null }, select: { id: true } })
        const people = (await tx.servicePerson.findMany()).map(p => ({ ...p, enabled: p.enabled && members.some(m => m.id === p.memberId), roles: p.roles as ServicePersonData['roles'] }))
        const dates = [...new Set([...local.map(w => w.startDate), ...source.rows.map(r => r.week.startDate), ...Object.keys(state.baseline)])].sort()
        if (resolution && !dates.includes(resolution.date)) throw new SyncError('找不到衝突週次，請重新同步')
        const targets: SyncWeek[] = [], pulls: { target: SyncWeek; assignments: Assignments }[] = []
        for (const date of dates) {
          const previous = local.find(w => w.startDate === date)
          const decision = planWeek(date, previous ? fromLocal(previous) : null, source.rows.filter(row => row.week.startDate === date), state.baseline[date], resolution)
          if (decision.conflict) { state.conflicts.push(decision.conflict); continue }
          if (!decision.target) continue
          const target = decision.target
          try {
            if (!previous || !sameWeek(fromLocal(previous), target)) pulls.push({ target, assignments: importedAssignments(target, previous?.assignments ?? {}, people) })
            targets.push(target)
          } catch (error) { if (error instanceof SyncError) state.errors.push(error.message); else throw error }
        }
        state.pushed = await writeRosterSheet(source, targets)
        for (const { target, assignments } of pulls) {
          const data = { startDate: target.startDate, endDate: target.endDate, stopped: target.stopped, note: target.note, assignments: assignments as Prisma.InputJsonValue }
          await tx.serviceWeek.upsert({ where: { startDate: target.startDate }, create: data, update: data })
          state.pulled++
        }
        if (state.pulled) await tx.serviceRosterState.update({ where: { id: 'main' }, data: { revision: { increment: 1 } } })
        for (const target of targets) state.baseline[target.startDate] = target
      } catch (error) {
        // External failure keeps the old baseline; an equal DB/Sheet pair can recover next run.
        if (!(error instanceof SyncError)) throw error
        state.errors.push(error.message)
      }
      state.lastRun = new Date().toISOString()
      await tx.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(state) }, update: { value: JSON.stringify(state) } })
      const { baseline: _, ...status } = state
      return status
    }, { timeout: 50000, maxWait: 5000 })
  } catch (error) {
    // Never expose OAuth responses or connection strings to the UI.
    const status = await rosterSyncStatus(db).catch(() => { const { baseline: _, ...rest } = emptySyncState(); return rest })
    return { ...status, pulled: 0, pushed: 0, errors: [error instanceof SyncError ? error.message : 'Google 同步未完成，請確認連線與試算表編輯權限後重試；本站安排仍保留'] }
  }
}
