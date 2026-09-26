import { Prisma, PrismaClient } from '@prisma/client'
import { isAreaDispatched } from './allocation'

export class DispatchConflict extends Error {}

export async function batchDispatch(db: PrismaClient, ids: string[], memberId: string, note: string | null, now = new Date()) {
  return db.$transaction(tx => dispatchInTransaction(tx, ids, memberId, note, now), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function dispatchInTransaction(tx: Prisma.TransactionClient, ids: string[], memberId: string, note: string | null, now: Date) {
  const member = await tx.member.findUnique({ where: { id: memberId }, select: { id: true, name: true, active: true } })
  if (!member?.active) throw new DispatchConflict('成員不存在或已停用，請重新選擇')
  const areas = await tx.area.findMany({ where: { id: { in: ids } } })
  if (areas.length !== ids.length) throw new DispatchConflict('部分地圖已不存在，請重新整理')
  if (areas.some(isAreaDispatched)) throw new DispatchConflict('部分地圖已被領取，本次全部未分發，請重新整理後選取')
  const result = await tx.area.updateMany({
    where: { id: { in: ids } },
    data: {
      assignedMemberId: member.id, assignedTo: member.name, assignNote: note,
      dispatchedAt: now, completedAt: null, lastActivityAt: now,
    },
  })
  return { count: result.count, areas, member, dispatchedAt: now }
}
