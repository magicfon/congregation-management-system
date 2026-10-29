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
  if (areas.some(area => area.dispatchEnabled === false)) throw new DispatchConflict('部分地圖已暫停分發，本次未分發')
  if (areas.some(isAreaDispatched)) throw new DispatchConflict('部分地圖已被領取，本次全部未分發，請重新整理後選取')
  // 每張地圖記下派發前的狀態，派錯人時可撤銷派發還原（ADR-0094）
  for (const area of areas) {
    await tx.area.update({
      where: { id: area.id },
      data: {
        assignedMemberId: member.id, assignedTo: member.name, assignNote: note,
        dispatchedAt: now, completedAt: null, lastActivityAt: now,
        dispatchUndo: dispatchUndoState(area, now),
      },
    })
  }
  return { count: areas.length, areas, member, dispatchedAt: now }
}

export type DispatchUndo = { dispatchedAt: string; assignedMemberId: string | null; assignedTo: string | null; assignNote: string | null; previousDispatchedAt: string | null; completedAt: string | null; lastActivityAt: string | null }
type UndoSource = { assignedMemberId: string | null; assignedTo: string | null; assignNote: string | null; dispatchedAt: Date | null; completedAt: Date | null; lastActivityAt?: Date | null }

export function dispatchUndoState(area: UndoSource, now: Date): DispatchUndo {
  return {
    dispatchedAt: now.toISOString(), assignedMemberId: area.assignedMemberId, assignedTo: area.assignedTo, assignNote: area.assignNote,
    previousDispatchedAt: area.dispatchedAt?.toISOString() ?? null, completedAt: area.completedAt?.toISOString() ?? null, lastActivityAt: area.lastActivityAt?.toISOString() ?? null,
  }
}

// 撤銷時比對的派發時間；沒有派發日的舊資料用空字串
export function undoKey(area: { dispatchedAt: Date | null }) { return area.dispatchedAt?.toISOString() ?? '' }

// 只有本系統派發、且仍是同一次派發的地圖可撤銷；Sheet 匯入或已交回後再派的舊紀錄不算
export function undoableDispatch(area: { assignedMemberId: string | null; dispatchedAt: Date | null; completedAt: Date | null; dispatchUndo?: unknown }): DispatchUndo | null {
  const undo = area.dispatchUndo as Partial<DispatchUndo> | null | undefined
  if (!undo || typeof undo !== 'object' || !area.dispatchedAt || !isAreaDispatched(area)) return null
  return undo.dispatchedAt === area.dispatchedAt.toISOString() ? undo as DispatchUndo : null
}
