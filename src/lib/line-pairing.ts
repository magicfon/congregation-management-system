import { Prisma, PrismaClient } from '@prisma/client'

export class LinePairingError extends Error {}

export async function pairLineMember(db: PrismaClient, sourceId: string, targetId: string, expectedUid: string) {
  if (sourceId === targetId) throw new LinePairingError('請選擇另一位成員')
  return db.$transaction(async (tx) => {
    const source = await tx.member.findUnique({ where: { id: sourceId } })
    const target = await tx.member.findUnique({ where: { id: targetId } })
    if (!source || !source.lineuid || source.lineuid !== expectedUid) {
      throw new LinePairingError('來源 LINE 綁定已變更，請重新整理')
    }
    if (!target?.active) throw new LinePairingError('目標成員不存在或已停用')
    if (target.lineuid) throw new LinePairingError('目標成員已綁定 LINE，請勿覆蓋')
    await tx.member.update({ where: { id: sourceId }, data: { lineuid: null, lineDisplayName: null } })
    await tx.member.update({
      where: { id: targetId },
      data: { lineuid: source.lineuid, lineDisplayName: source.lineDisplayName },
    })
    return { memberId: targetId, memberName: target.name }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
