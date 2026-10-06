import { personalReminderDue } from './personal-territory-reminders'
import { randomUUID } from 'crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { botText, lineBotReady, lineRequest } from './line-bot-client'

export async function queueLineNotification(tx: Prisma.TransactionClient, memberId: string, text: string, now: Date) {
  if (!lineBotReady()) return null
  const member = await tx.member.findUnique({ where: { id: memberId }, select: { active: true, lineuid: true, lineNotificationsEnabled: true } })
  if (!member?.active || !member.lineuid || !member.lineNotificationsEnabled) return null
  const id = randomUUID()
  await tx.lineNotification.create({ data: { id, memberId, lineUid: member.lineuid, text, expiresAt: new Date(now.getTime()+23*60*60*1000) } })
  return id
}

export async function drainLineNotifications(db: PrismaClient, ids?: string[], now = new Date(), limit = 5) {
  if (!lineBotReady()) return { enabled: false, accepted: 0, deferred: 0, failed: 0 }
  const result = { enabled: true, accepted: 0, deferred: 0, failed: 0 }
  const jobs = await db.lineNotification.findMany({ where: { status: 'pending', nextAttemptAt: { lte: now }, ...(ids ? { id: { in: ids } } : {}) }, orderBy: { createdAt: 'asc' }, take: Math.min(250, Math.max(1, limit)) })
  for (let offset = 0; offset < jobs.length; offset += 5) {
    await Promise.all(jobs.slice(offset, offset + 5).map(async job => {
    // A lease prevents concurrent workers; stable retry keys protect ambiguous network responses.
    const claimed = await db.lineNotification.updateMany({ where: { id: job.id, status: 'pending', nextAttemptAt: { lte: now } }, data: { nextAttemptAt: new Date(now.getTime()+60000), attempts: { increment: 1 } } })
    if (!claimed.count) return
    const member = await db.member.findUnique({ where: { id: job.memberId }, select: { active: true, lineuid: true, lineNotificationsEnabled: true } })
    if (member && !member.lineNotificationsEnabled) {
      await db.lineNotification.update({ where: { id: job.id }, data: { status: 'cancelled', lastError: 'notifications_disabled' } }); return
    }
    if (job.expiresAt <= now || !member?.active || member.lineuid !== job.lineUid) {
      await db.lineNotification.update({ where: { id: job.id }, data: { status: 'failed', lastError: job.expiresAt <= now ? 'expired' : 'binding_changed' } }); result.failed++; return
    }
    if (job.reminderRequestId) {
      const request = await db.mapRequest.findUnique({ where: { id: job.reminderRequestId }, include: { area: true } })
      if (!request || request.memberId !== job.memberId || !personalReminderDue(request, now)) {
        await db.lineNotification.update({ where: { id: job.id }, data: { status: 'cancelled', lastError: 'reminder_no_longer_due' } }); return
      }
    }
    try {
      const sent = await lineRequest('push', { to: job.lineUid, messages: [botText(job.text)] }, job.id)
      if (sent.accepted) {
        await db.lineNotification.update({ where: { id: job.id }, data: { status: 'accepted', acceptedAt: new Date(), lastError: null } }); result.accepted++; return
      }
      if (sent.status < 500) {
        await db.lineNotification.update({ where: { id: job.id }, data: { status: 'failed', lastError: `HTTP ${sent.status}` } }); result.failed++; return
      }
    } catch { /* Network errors remain pending; never roll back the ministry action. */ }
    await db.lineNotification.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(now.getTime()+Math.min(3600000,60000*2**Math.min(job.attempts,6))), lastError: 'temporary_failure' } }); result.deferred++
    }))
  }
  return result
}
