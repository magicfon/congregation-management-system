import type { PrismaClient } from '@prisma/client'
import { taipeiDate } from './google-sheets'
import { botSite, lineBotReady } from './line-bot-client'
import { queueReminder } from './reminder-recipients'

// 管理待辦 LINE 提醒（ADR-0148 修訂）：看板「管理待辦」四項有待辦才發，不需設定，
// 自動發給所有管理員（已連結 LINE、未關閉通知），每天每人最多一則。學生通知單不算。
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export type AdminTaskCounts = { line: number; requests: number; alerts: number; doNotVisit: number }

/** 與看板「管理待辦」同一套計算 */
export async function adminTaskCounts(db: PrismaClient): Promise<AdminTaskCounts> {
  const [line, requests, alerts, doNotVisit] = await Promise.all([
    db.pendingLineIdentity.count(),
    db.mapRequest.count({ where: { status: 'pending' } }),
    db.reportAlert.count({ where: { status: 'pending' } }),
    db.doNotVisitReport.count({ where: { status: 'pending' } }),
  ])
  return { line, requests, alerts, doNotVisit }
}

export function adminTaskTotal(counts: AdminTaskCounts) {
  return counts.line + counts.requests + counts.alerts + counts.doNotVisit
}

export function adminTaskReminderText(counts: AdminTaskCounts, today: string) {
  const items: [string, number, string][] = [
    ['LINE 待確認', counts.line, '人'],
    ['領圖待審', counts.requests, '張'],
    ['回報待確認', counts.alerts, '則'],
    ['拒訪待審', counts.doNotVisit, '筆'],
  ]
  const lines = items.filter(([, n]) => n > 0).map(([label, n, unit]) => `・${label} ${n} ${unit}`)
  if (!lines.length) return null
  const weekday = WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()]
  return [`管理待辦提醒（${Number(today.slice(5, 7))}/${Number(today.slice(8, 10))}（${weekday}））`, '', ...lines, '', `請到我的看板處理：${botSite}/dashboard`].join('\n')
}

/** 每日排程：沒有待辦就不發；同一天同一人只排一次（固定 id），重跑只會補發未送達的 */
export async function sendAdminTaskReminders(db: PrismaClient, now = new Date()) {
  if (!lineBotReady()) return { skipped: 'line_disabled' as const }
  const today = taipeiDate(now)
  const counts = await adminTaskCounts(db)
  const text = adminTaskReminderText(counts, today)
  if (!text) return { skipped: 'no_tasks' as const, date: today }
  const admins = await db.member.findMany({ where: { role: 'admin', active: true, deletedAt: null }, select: { id: true } })
  const result = await queueReminder(db, admins.map(a => a.id), `admin-tasks:${today}`, text, now, 12)
  return { date: today, tasks: adminTaskTotal(counts), ...result }
}
