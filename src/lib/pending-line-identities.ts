import { randomUUID } from 'crypto'
import { hash } from 'bcryptjs'
import { Prisma, type PrismaClient } from '@prisma/client'
import { LinePairingError } from './line-pairing'
import { queuePairingNotice } from './line-pairing-notification'

export const pendingLineMessage = '待管理員確認權限。您的 LINE 帳號已登記，請聯絡管理員連結成員。'

// Only called after OAuth or webhook signature validation. Serializes with approval.
export async function recordPendingLineIdentity(db: PrismaClient, uid: string, displayName?: string | null) {
  if (!/^U[0-9a-f]{32}$/i.test(uid)) throw new Error('Invalid LINE UID')
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const member = await tx.member.findUnique({ where: { lineuid: uid }, select: { id: true } })
        if (member) return
        await tx.pendingLineIdentity.upsert({
          where: { uid },
          create: { uid, displayName: displayName?.slice(0, 200) || null },
          update: { lastSeenAt: new Date(), ...(displayName ? { displayName: displayName.slice(0, 200) } : {}) },
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) continue
      throw error
    }
  }
}

export async function linkPendingLineIdentity(db: PrismaClient, uid: string, targetId: string) {
  return db.$transaction(async tx => {
    const pending = await tx.pendingLineIdentity.findUnique({ where: { uid } })
    if (!pending) throw new LinePairingError('此 LINE 帳號已處理，請重新整理')
    const existing = await tx.member.findUnique({ where: { lineuid: uid } })
    if (existing) throw new LinePairingError('此 UID 已綁定其他成員，請重新整理')
    const target = await tx.member.findUnique({ where: { id: targetId } })
    if (!target?.active) throw new LinePairingError('目標成員不存在或已停用')
    if (target.lineuid) throw new LinePairingError('目標成員已綁定 LINE，請勿覆蓋')
    await tx.member.update({ where: { id: targetId }, data: { lineuid: uid, lineDisplayName: pending.displayName } })
    await tx.pendingLineIdentity.delete({ where: { uid } })
    const notificationId = await queuePairingNotice(tx, target)
    return { memberId: target.id, memberName: target.name, notificationId }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function createPendingLineMember(db: PrismaClient, uid: string, name: string, role: 'admin' | 'publisher', actorId: string) {
  const password = await hash(randomUUID(), 10)
  return db.$transaction(async tx => {
    const actor = await tx.member.findUnique({ where: { id: actorId } })
    if (!actor?.active || actor.deletedAt || actor.role !== 'admin') throw new LinePairingError('只有管理員可建立並連結')
    const pending = await tx.pendingLineIdentity.findUnique({ where: { uid } })
    if (!pending) throw new LinePairingError('此 LINE 帳號已處理，請重新整理')
    const existing = await tx.member.findUnique({ where: { lineuid: uid } })
    if (existing) throw new LinePairingError('此 UID 已綁定其他成員，請重新整理')
    const member = await tx.member.create({ data: {
      name, role, active: true, lineuid: uid, lineDisplayName: pending.displayName,
      email: `line-${randomUUID()}@members.invalid`, password,
    } })
    await tx.pendingLineIdentity.delete({ where: { uid } })
    const notificationId = await queuePairingNotice(tx, member)
    return { memberId: member.id, memberName: member.name, notificationId }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
