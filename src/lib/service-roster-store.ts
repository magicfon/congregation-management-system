import type { Prisma, PrismaClient } from '@prisma/client'
import { readServiceSource } from './service-roster-import'
import { addDays, validMonday, serviceRoles, RosterError, validateAssignments, fillServiceVacancies, type Assignments, type ServicePersonData, type ServiceWeekData } from './service-roster'
const json = (value: unknown) => value as Prisma.InputJsonValue
export class RosterConflict extends RosterError {}

export async function initializeServiceRoster(db: PrismaClient) {
  if (await db.serviceRosterState.findUnique({ where: { id: 'main' } })) return
  const source = await readServiceSource()
  await db.$transaction(async tx => {
    if (await tx.serviceRosterState.findUnique({ where: { id: 'main' } })) return
    await tx.serviceRosterState.create({ data: { id: 'main' } })
    const members = await tx.member.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true } })
    const names = new Set([...source.qualifications.keys(), ...source.weeks.flatMap(w => Object.values(w.names))])
    const people = new Map<string, { id: string; name: string }>()
    for (const name of names) {
      const matches = members.filter(m => m.name.trim() === name)
      const match = matches.length === 1 ? matches[0] : null
      const person = await tx.servicePerson.create({ data: { name, memberId: match?.id, enabled: Boolean(match), roles: source.qualifications.get(name) ?? [] } })
      people.set(name, person)
    }
    for (const week of source.weeks) {
      const assignments = Object.fromEntries(Object.entries(week.names).map(([role, name]) => [role, { personId: people.get(name)!.id, name }]))
      await tx.serviceWeek.create({ data: { startDate: week.startDate, endDate: week.endDate, note: week.note, stopped: week.stopped, assignments } })
    }
  }, { isolationLevel: 'Serializable', timeout: 30000 })
}

export async function rosterSnapshot(db: PrismaClient, privateData = false) {
  return db.$transaction(async tx => {
    const state = await tx.serviceRosterState.findUnique({ where: { id: 'main' } })
    const weeks = await tx.serviceWeek.findMany({ orderBy: { startDate: 'asc' } })
    if (!privateData) return { initialized: Boolean(state), revision: state?.revision ?? 0, weeks }
    const members = await tx.member.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    const people = await tx.servicePerson.findMany({ orderBy: { name: 'asc' } })
    return { initialized: Boolean(state), revision: state?.revision ?? 0, weeks, members, people: people.map(p => ({ ...p, enabled: p.enabled && members.some(m => m.id === p.memberId) })) }
  }, { isolationLevel: 'RepeatableRead' })
}

async function effectivePeople(tx: Prisma.TransactionClient): Promise<ServicePersonData[]> {
  const members = await tx.member.findMany({ where: { active: true, deletedAt: null }, select: { id: true } })
  return (await tx.servicePerson.findMany()).map(p => ({ ...p, enabled: p.enabled && members.some(m => m.id === p.memberId), roles: p.roles as ServicePersonData['roles'] }))
}
export async function editServiceRoster(db: PrismaClient, body: Record<string, unknown>) {
  if (!Number.isInteger(body.revision)) throw new RosterError('請重新載入最新安排')
  return db.$transaction(async tx => {
    const state = await tx.serviceRosterState.findUnique({ where: { id: 'main' } })
    if (!state || state.revision !== body.revision) throw new RosterConflict('安排已更新，請重新載入再編輯')
    const people = await effectivePeople(tx)
    if (body.action === 'preview') {
      const week = await tx.serviceWeek.findUnique({ where: { startDate: String(body.startDate) } })
      if (!week) throw new RosterError('找不到週次')
      const assignments = validateAssignments(body.assignments, week.assignments as Assignments, people)
      return fillServiceVacancies({ ...week, assignments, stopped: typeof body.stopped === 'boolean' ? body.stopped : week.stopped }, people, (await tx.serviceWeek.findMany()) as unknown as ServiceWeekData[])
    }
    const locked = await tx.serviceRosterState.updateMany({ where: { id: 'main', revision: Number(body.revision) }, data: { revision: { increment: 1 } } })
    if (!locked.count) throw new RosterConflict('安排已更新，請重新載入再編輯')
    if (body.action === 'week' || body.action === 'create') {
      if (!validMonday(body.startDate) || typeof body.note !== 'string' || body.note.length > 300 || typeof body.stopped !== 'boolean') throw new RosterError('請選擇星期一，並填寫有效停排資訊')
      if (body.stopped && !body.note.trim()) throw new RosterError('停排週請填原因')
      const previous = await tx.serviceWeek.findUnique({ where: { startDate: body.startDate } })
      if ((body.action === 'create') === Boolean(previous)) throw new RosterError(previous ? '這個週次已存在' : '找不到週次')
      const assignments = validateAssignments(body.assignments, (previous?.assignments ?? {}) as Assignments, people)
      const data = { startDate: body.startDate, endDate: addDays(body.startDate, 6), stopped: body.stopped, note: body.note.trim(), assignments: json(assignments) }
      if (previous) await tx.serviceWeek.update({ where: { startDate: body.startDate }, data })
      else await tx.serviceWeek.create({ data })
    } else if (body.action === 'person') {
      if (typeof body.memberId !== 'string' || typeof body.enabled !== 'boolean' || !Array.isArray(body.roles) || body.roles.some(role => !serviceRoles.some(r => r.id === role))) throw new RosterError('資格設定格式錯誤')
      const member = await tx.member.findFirst({ where: { id: body.memberId, active: true, deletedAt: null } })
      if (!member) throw new RosterError('請選擇啟用成員')
      const bound = await tx.servicePerson.findFirst({ where: { memberId: member.id } })
      if (bound && bound.id !== body.id) throw new RosterError('這位成員已在資格名單，請編輯現有人員')
      const data = { memberId: member.id, name: member.name, enabled: body.enabled, roles: json([...new Set(body.roles)]) }
      if (typeof body.id === 'string' && body.id) await tx.servicePerson.update({ where: { id: body.id }, data })
      else await tx.servicePerson.create({ data })
    } else throw new RosterError('未知操作')
    return { saved: true }
  }, { isolationLevel: 'Serializable', timeout: 15000 })
}
