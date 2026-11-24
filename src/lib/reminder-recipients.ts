import { createHash } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { drainLineNotifications } from './line-notifications'

// 管理員開關＋指定收件人的 LINE 排程提醒共用設定（ADR-0145、ADR-0148）。設定存在 settings 表，不改資料庫結構。
export type ReminderSettings<R> = { enabled: boolean; memberIds: string[]; lastRun?: R | null }

export async function readReminderSettingsByKey<R>(db: PrismaClient, key: string): Promise<ReminderSettings<R>> {
  const row = await db.setting.findUnique({ where: { key } })
  try {
    const value = row ? JSON.parse(row.value) : {}
    return { enabled: value.enabled === true, memberIds: Array.isArray(value.memberIds) ? value.memberIds.filter((id: unknown) => typeof id === 'string') : [], lastRun: value.lastRun ?? null }
  } catch { return { enabled: false, memberIds: [], lastRun: null } }
}

export async function writeReminderSettingsByKey<R>(db: PrismaClient, key: string, settings: ReminderSettings<R>) {
  const value = JSON.stringify(settings)
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

/** 管理工具卡片用：在籍成員與是否收得到 LINE 私訊 */
export async function reminderMemberOptions(db: PrismaClient) {
  const members = await db.member.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true, lineuid: true, lineNotificationsEnabled: true }, orderBy: { name: 'asc' } })
  return members.map(m => ({ id: m.id, name: m.name, linked: !!m.lineuid, notifications: m.lineNotificationsEnabled }))
}

/** 管理工具卡片 PUT：驗證並寫回開關與收件人；格式錯誤回 null */
export async function saveReminderRecipients(db: PrismaClient, key: string, body: unknown) {
  const input = body as { enabled?: unknown; memberIds?: unknown } | null
  if (!input || typeof input.enabled !== 'boolean' || !Array.isArray(input.memberIds) || input.memberIds.some(id => typeof id !== 'string') || input.memberIds.length > 50) return null
  const requested = input.memberIds as string[]
  const valid = await db.member.findMany({ where: { id: { in: requested }, deletedAt: null }, select: { id: true } })
  const ids = new Set(valid.map(m => m.id))
  const current = await readReminderSettingsByKey(db, key)
  await writeReminderSettingsByKey(db, key, { ...current, enabled: input.enabled, memberIds: requested.filter((id, i, all) => ids.has(id) && all.indexOf(id) === i) })
  return true
}

export function stableId(key: string) {
  const hex = createHash('sha256').update(key).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** 排入 line_notifications 並立即送出；id 由 dedupeKey＋成員決定，重跑不會重複 */
export async function queueReminder(db: PrismaClient, memberIds: string[], dedupeKey: string, text: string, now: Date, ttlHours: number) {
  const members = await db.member.findMany({ where: { id: { in: memberIds }, active: true, deletedAt: null, lineuid: { not: null }, lineNotificationsEnabled: true }, select: { id: true, lineuid: true } })
  const data = members.map(member => ({ id: stableId(`${dedupeKey}:${member.id}`), memberId: member.id, lineUid: member.lineuid!, text, nextAttemptAt: now, expiresAt: new Date(now.getTime() + ttlHours * 3600000) }))
  const queued = data.length ? (await db.lineNotification.createMany({ data, skipDuplicates: true })).count : 0
  const delivery = data.length ? await drainLineNotifications(db, data.map(d => d.id), now, 250) : null
  return { recipients: data.length, queued, delivery }
}
