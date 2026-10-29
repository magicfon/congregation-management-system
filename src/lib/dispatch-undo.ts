import { Prisma, PrismaClient } from '@prisma/client'
import { isAreaDispatched } from './allocation'
import { undoableDispatch, undoKey, type DispatchUndo } from './batch-dispatch'
import { ministryCycle } from './ministry'

export class UndoConflict extends Error {}

// 上線前的派發沒有派發前紀錄：只能清空持有人與派發日（使用者 2026-10-29 決定）
const LEGACY_UNDO: Omit<DispatchUndo, 'dispatchedAt'> = { assignedMemberId: null, assignedTo: null, assignNote: null, previousDispatchedAt: null, completedAt: null, lastActivityAt: null }

// 撤銷派發：還原成派發前的狀態，不算完成、不改上次完成日，並刪掉這次派發期間的傳道安排（ADR-0094）
export async function undoDispatch(db: PrismaClient, areaId: string, expectedDispatchedAt: string) {
  return db.$transaction(async tx => {
    const area = await tx.area.findUnique({ where: { id: areaId } })
    if (!area) throw new UndoConflict('地圖不存在，請重新整理')
    if (!isAreaDispatched(area) || undoKey(area) !== expectedDispatchedAt) throw new UndoConflict('這張地圖已交回或重新派發，請重新整理')
    const recorded = undoableDispatch(area), undo = recorded ?? LEGACY_UNDO
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
    return { sheetNo: area.sheetNo, holder: area.assignedTo, legacy: !recorded, previousDispatchedAt, removedVisits: removedVisits.count }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
