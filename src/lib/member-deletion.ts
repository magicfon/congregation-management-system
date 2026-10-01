import { Prisma, type PrismaClient } from '@prisma/client'
import { isAreaDispatched } from './allocation'
import { taipeiDate } from './google-sheets'

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
    const visit = await tx.ministryVisit.findFirst({ where: {
      OR: [{ publisherId: id }, { managerId: id }], status: { in: ['planned', 'active'] },
    } })
    const schedule = await tx.schedule.findFirst({ where: {
      leaderId: id, status: 'scheduled', date: { gte: new Date(`${taipeiDate(now)}T00:00:00+08:00`) },
    } })
    if (visit || schedule) throw new MemberDeletionError('請先取消或轉移未完成行程')
    // Preserve historical relations, but release the login identity.
    await tx.member.update({ where: { id }, data: {
      deletedAt: now, active: false, showInDispatch: false, lineuid: null, lineDisplayName: null,
      email: `deleted-${id}@deleted.invalid`, password: '', phone: null,
    } })
    await tx.mapRequest.updateMany({ where: { memberId: id, status: 'pending' }, data: { status: 'cancelled' } })
    await tx.lineNotification.updateMany({ where: { memberId: id, status: 'pending' }, data: { status: 'cancelled', lastError: 'member_deleted' } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
