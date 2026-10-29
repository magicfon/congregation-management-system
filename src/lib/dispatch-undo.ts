import { Prisma, PrismaClient } from '@prisma/client'
import { undoableDispatch } from './batch-dispatch'
import { ministryCycle } from './ministry'

export class UndoConflict extends Error {}

// 撤銷派發：還原成派發前的狀態，不算完成、不改上次完成日，並刪掉這次派發期間的傳道安排（ADR-0094）
export async function undoDispatch(db: PrismaClient, areaId: string, expectedDispatchedAt: string) {
  return db.$transaction(async tx => {
    const area = await tx.area.findUnique({ where: { id: areaId } })
    if (!area) throw new UndoConflict('地圖不存在，請重新整理')
    const undo = undoableDispatch(area)
    if (!undo || area.dispatchedAt?.toISOString() !== expectedDispatchedAt) throw new UndoConflict('這張地圖已交回、重新派發，或不是由網站派發，無法撤銷；請重新整理，必要時改用交回')
    const removedVisits = await tx.ministryVisit.deleteMany({ where: { areaId, cycleKey: ministryCycle(area) } })
    const previousDispatchedAt = undo.previousDispatchedAt ? new Date(undo.previousDispatchedAt) : null
    await tx.area.update({
      where: { id: areaId },
      data: {
        assignedMemberId: undo.assignedMemberId, assignedTo: undo.assignedTo, assignNote: undo.assignNote,
        dispatchedAt: previousDispatchedAt, completedAt: undo.completedAt ? new Date(undo.completedAt) : null,
        lastActivityAt: undo.lastActivityAt ? new Date(undo.lastActivityAt) : new Date(), dispatchUndo: Prisma.DbNull,
        ministryRevision: { increment: 1 },
      },
    })
    return { sheetNo: area.sheetNo, holder: area.assignedTo, previousDispatchedAt, removedVisits: removedVisits.count }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
