import type { PrismaClient } from '@prisma/client'
import { taipeiDate } from './google-sheets'
import { botSite, lineBotReady } from './line-bot-client'
import { queueReminder, readReminderSettingsByKey, ReminderSettings, writeReminderSettingsByKey } from './reminder-recipients'
import { studentNoticeOverview } from './student-notice'

// 管理待辦每日 LINE 彙整提醒（ADR-0148）：有待辦才發，每天每人最多一則。
export const ADMIN_TASK_REMINDER_KEY = 'admin_task_reminder'
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export type AdminTaskReminderRun = { date: string; tasks: number; queued: number; at: string }
export type AdminTaskReminderSettings = ReminderSettings<AdminTaskReminderRun>
export type AdminTaskCounts = { line: number; requests: number; alerts: number; doNotVisit: number; noticesUnconfirmed: number | null; noticesHandoff: number | null; noticesPending: number | null }

export const readAdminTaskReminderSettings = (db: PrismaClient): Promise<AdminTaskReminderSettings> => readReminderSettingsByKey(db, ADMIN_TASK_REMINDER_KEY)

/** 與看板「管理待辦」、「學生通知單」同一套計算；通知單讀不到時只略過那兩行 */
export async function adminTaskCounts(db: PrismaClient, today: string): Promise<AdminTaskCounts> {
  const [line, requests, alerts, doNotVisit, notices] = await Promise.all([
    db.pendingLineIdentity.count(),
    db.mapRequest.count({ where: { status: 'pending' } }),
    db.reportAlert.count({ where: { status: 'pending' } }),
    db.doNotVisitReport.count({ where: { status: 'pending' } }),
    studentNoticeOverview(db, today).catch(error => { console.error('admin task reminder: student notices unavailable', error); return null }),
  ])
  const rows = notices?.flatMap(week => week.rows) ?? null
  return {
    line, requests, alerts, doNotVisit,
    noticesUnconfirmed: rows && rows.filter(row => row.status === 'unchanged' && !row.confirmedAt).length,
    noticesHandoff: rows && rows.filter(row => row.status === 'unreachable').length,
    noticesPending: rows && rows.filter(row => row.status === 'new' || row.status === 'updated' || row.status === 'cancel').length,
  }
}

export function adminTaskTotal(counts: AdminTaskCounts) {
  return counts.line + counts.requests + counts.alerts + counts.doNotVisit + (counts.noticesUnconfirmed ?? 0) + (counts.noticesHandoff ?? 0) + (counts.noticesPending ?? 0)
}

export function adminTaskReminderText(counts: AdminTaskCounts, today: string) {
  const items: [string, number | null, string][] = [
    ['LINE 待連結成員', counts.line, '人'],
    ['領圖申請待審', counts.requests, '張'],
    ['回報待確認', counts.alerts, '則'],
    ['拒訪待審', counts.doNotVisit, '筆'],
    ['學生通知單已發送未確認', counts.noticesUnconfirmed, '人'],
    ['學生通知單需自行轉交', counts.noticesHandoff, '人'],
    ['學生通知單尚未發送或需重發', counts.noticesPending, '張'],
  ]
  const lines = items.filter(([, n]) => n).map(([label, n, unit]) => `・${label} ${n} ${unit}`)
  if (!lines.length) return null
  const weekday = WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()]
  return [`管理待辦提醒（${Number(today.slice(5, 7))}/${Number(today.slice(8, 10))}（${weekday}））`, '', ...lines, '', `請到我的看板處理：${botSite}/dashboard`].join('\n')
}

export async function buildAdminTaskReminder(db: PrismaClient, now = new Date()) {
  const today = taipeiDate(now)
  const counts = await adminTaskCounts(db, today)
  return { today, counts, total: adminTaskTotal(counts), text: adminTaskReminderText(counts, today) }
}

/** 每日排程：沒有待辦就不發；同一天同一人只排一次（固定 id），重跑只會補發未送達的 */
export async function sendAdminTaskReminders(db: PrismaClient, now = new Date()) {
  const settings = await readAdminTaskReminderSettings(db)
  if (!settings.enabled) return { skipped: 'disabled' as const }
  if (!lineBotReady()) return { skipped: 'line_disabled' as const }
  const reminder = await buildAdminTaskReminder(db, now)
  const result = reminder.text ? await queueReminder(db, settings.memberIds, `admin-tasks:${reminder.today}`, reminder.text, now, 12) : null
  await writeReminderSettingsByKey(db, ADMIN_TASK_REMINDER_KEY, { ...(await readAdminTaskReminderSettings(db)), lastRun: { date: reminder.today, tasks: reminder.total, queued: result?.queued ?? 0, at: now.toISOString() } })
  return result ? { date: reminder.today, tasks: reminder.total, ...result } : { skipped: 'no_tasks' as const, date: reminder.today }
}
