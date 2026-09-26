import { randomUUID } from 'crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { isAreaDispatched } from './allocation'
import { dispatchInTransaction, DispatchConflict } from './batch-dispatch'

export class RequestConflict extends Error {}
export async function submitMapRequests(db: PrismaClient, memberId: string, ids: string[]) {
  return db.$transaction(async tx => {
    const member = await tx.member.findUnique({ where: { id: memberId }, select: { active: true } })
    if (!member?.active) throw new RequestConflict('帳號已停用或尚未配對有效成員')
    const pending = await tx.mapRequest.findMany({ where: { memberId, status: 'pending' }, select: { areaId: true } })
    if (pending.length + ids.length > 5) throw new RequestConflict('每人待審最多 5 張，請先取消或等候已有申請審核')
    if (pending.some(r => ids.includes(r.areaId))) throw new RequestConflict('選取的地圖已有待審申請')
    const areas = await tx.area.findMany({ where: { id: { in: ids } } })
    if (areas.length !== ids.length || areas.some(isAreaDispatched)) throw new RequestConflict('部分地圖已被領取或不存在，請重新整理')
    const batchId = randomUUID()
    await tx.mapRequest.createMany({ data: ids.map(areaId => ({ memberId, areaId, batchId })) })
    return { count: ids.length }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
export async function decideMapRequest(db: PrismaClient, id: string, actor: { id: string; isAdmin: boolean }, action: 'approve' | 'reject' | 'cancel', now = new Date()) {
  return db.$transaction(async tx => {
    const request = await tx.mapRequest.findUnique({ where: { id } })
    if (!request || request.status !== 'pending') throw new RequestConflict('申請不存在或已處理，請重新整理')
    if (action === 'cancel' ? request.memberId !== actor.id : !actor.isAdmin) throw new RequestConflict('不能處理這筆申請')
    // Mark and dispatch in the same transaction; a failed allocation rolls back the decision.
    const updated = await tx.mapRequest.updateMany({ where: { id, status: 'pending' }, data: { status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'cancelled', reviewedBy: actor.id, reviewedAt: now } })
    if (updated.count !== 1) throw new RequestConflict('申請已被其他人處理，請重新整理')
    if (action !== 'approve') return null
    return dispatchInTransaction(tx, [request.areaId], request.memberId, null, now)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
export function requestError(error: unknown) {
  if (error instanceof RequestConflict || error instanceof DispatchConflict) return error.message
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) return '申請或分配狀態同時被修改，請重新整理後再試'
  return null
}
