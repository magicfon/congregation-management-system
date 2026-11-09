import { Prisma, type PrismaClient } from '@prisma/client'
import { isAreaDispatched } from './allocation'

export class MemberDeletionError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

export async function deleteMember(db: PrismaClient, id: string, actorId: string, now = new Date()) {
  if (id === actorId) throw new MemberDeletionError('不能刪除目前登入的帳號')
  return db.$transaction(async tx => {
    const member = await tx.member.findUnique({ where: { id } })
    if (!member || member.deletedAt) throw new MemberDeletionError('成員不存在', 404)
    const areas = await tx.area.findMany({ where: { assignedMemberId: id } })
    if (areas.some(isAreaDispatched)) throw new MemberDeletionError('請先交回或轉移持有的地圖')
    // 地圖交接已關閉（ADR-0120），沒有介面能取消傳道安排，不再以此擋刪除。
    // Preserve historical relations, but release the login identity.
    await tx.member.update({ where: { id }, data: {
      deletedAt: now, active: false, showInDispatch: false, lineuid: null, lineDisplayName: null, linePictureUrl: null,
      email: `deleted-${id}@deleted.invalid`, password: '', phone: null,
    } })
    await tx.mapRequest.updateMany({ where: { memberId: id, status: 'pending' }, data: { status: 'cancelled' } })
    await tx.lineNotification.updateMany({ where: { memberId: id, status: 'pending' }, data: { status: 'cancelled', lastError: 'member_deleted' } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
