import { createHash } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { isAreaDispatched, allocationLabel } from './allocation'
import { taipeiDate } from './google-sheets'
import { botSite, lineBotReady } from './line-bot-client'

type ReminderRequest = {
  status: string; memberId: string; reviewedAt: Date | null
  area: { personalTerritory: boolean; assignedMemberId: string | null; dispatchedAt: Date | null; completedAt: Date | null; lastReportedCompletedAt: Date | null }
}
export function personalDueDate(reviewedAt: Date) {
  const date = new Date(`${taipeiDate(reviewedAt)}T00:00:00+08:00`)
  return taipeiDate(new Date(date.getTime() + 30 * 86400000))
}
export function personalReminderDue(request: ReminderRequest | null, now: Date) {
  if (!request || request.status !== 'approved' || !request.reviewedAt) return false
  const area = request.area
  if (!area.personalTerritory || !isAreaDispatched(area) || area.assignedMemberId !== request.memberId || area.dispatchedAt?.getTime() !== request.reviewedAt.getTime()) return false
  if (area.lastReportedCompletedAt && taipeiDate(area.lastReportedCompletedAt) >= taipeiDate(request.reviewedAt)) return false
  return taipeiDate(now) >= personalDueDate(request.reviewedAt)
}
export async function queuePersonalTerritoryReminders(db: PrismaClient, now = new Date()) {
  if (!lineBotReady()) return { queued: 0 }
  const requests = await db.mapRequest.findMany({ where: { status: 'approved', reviewedAt: { not: null }, area: { personalTerritory: true }, member: { active: true, lineuid: { not: null }, lineNotificationsEnabled: true } }, include: { area: true, member: true } })
  let queued = 0
  for (const request of requests) {
    if (!personalReminderDue(request, now) || !request.member.lineuid) continue
    const hex = createHash('sha256').update(`personal-territory-30:${request.id}`).digest('hex')
    const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
    const result = await db.lineNotification.createMany({ skipDuplicates: true, data: [{
      id, memberId: request.memberId, lineUid: request.member.lineuid, reminderRequestId: request.id,
      text: `個人區域回報提醒\n${allocationLabel(request.area)}\n回報期限：${personalDueDate(request.reviewedAt!)}（領取後 30 天）\n尚未收到本次完成回報，請記得回報進度。\n${botSite}/dashboard`,
      nextAttemptAt: now, expiresAt: new Date(now.getTime() + 23 * 3600000),
    }] })
    queued += result.count
  }
  return { queued }
}
