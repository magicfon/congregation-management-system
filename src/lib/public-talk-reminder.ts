import { createHash } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { taipeiDate } from './google-sheets'
import { lineBotReady } from './line-bot-client'
import { drainLineNotifications } from './line-notifications'

// 公眾演講秩序表（公開試算表，與公布欄「公眾演講」同一份）。ADR-0145
export const PUBLIC_TALK_SHEET_ID = '10dCF6Wcqp-11g4vHSYGCekfvGvBE8MKzOqTxgt9-jtM'
const SETTING_KEY = 'public_talk_reminder'
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export type PublicTalkReminderSettings = { enabled: boolean; memberIds: string[]; lastRun?: { week: string; queued: number; at: string } | null }
export type PublicTalkEntry = { date: string; number: string; title: string; speaker: string }

export async function readReminderSettings(db: PrismaClient): Promise<PublicTalkReminderSettings> {
  const row = await db.setting.findUnique({ where: { key: SETTING_KEY } })
  try {
    const value = row ? JSON.parse(row.value) : {}
    return { enabled: value.enabled === true, memberIds: Array.isArray(value.memberIds) ? value.memberIds.filter((id: unknown) => typeof id === 'string') : [], lastRun: value.lastRun ?? null }
  } catch { return { enabled: false, memberIds: [], lastRun: null } }
}

export async function writeReminderSettings(db: PrismaClient, settings: PublicTalkReminderSettings) {
  const value = JSON.stringify(settings)
  await db.setting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } })
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function addDays(date: string, days: number) {
  return taipeiDate(new Date(new Date(`${date}T00:00:00+08:00`).getTime() + days * 86400000))
}

/** 台北時間本週一～週日（YYYY-MM-DD） */
export function taipeiWeek(now: Date) {
  const today = taipeiDate(now)
  const day = new Date(`${today}T12:00:00Z`).getUTCDay()
  const monday = addDays(today, -((day + 6) % 7))
  return { monday, sunday: addDays(monday, 6) }
}

// 表上日期只有月/日：第一筆取離本週最近的一年，之後依「2027年」分隔列與月份倒退推算跨年
function nearestYear(month: number, day: number, monday: string) {
  const ref = new Date(`${monday}T00:00:00+08:00`).getTime()
  const base = Number(monday.slice(0, 4))
  return [base - 1, base, base + 1].sort((a, b) => Math.abs(Date.parse(ymd(a, month, day)) - ref) - Math.abs(Date.parse(ymd(b, month, day)) - ref))[0]
}
const ymd = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** 找出本週（週一～週日）的公眾演講；沒有演講列時改用落在本週的活動整列文字 */
export function findWeekTalks(rows: string[][], monday: string, sunday: string): PublicTalkEntry[] {
  const talks: PublicTalkEntry[] = []
  const events: PublicTalkEntry[] = []
  const inWeek = (date: string) => date >= monday && date <= sunday
  let year: number | null = null
  let lastMonth = 0
  const dated = (month: number, day: number) => {
    if (year == null) year = nearestYear(month, day, monday)
    else if (month < lastMonth - 6) year++
    lastMonth = month
    return ymd(year, month, day)
  }
  for (const row of rows) {
    const first = (row[0] ?? '').trim()
    const rest = row.slice(1).every(v => !(v ?? '').trim())
    const yearRow = first.match(/^(\d{4})年$/)
    if (yearRow && rest) { year = Number(yearRow[1]); lastMonth = 0; continue }
    const md = first.match(/^(\d{1,2})\/(\d{1,2})$/)
    if (md) {
      const date = dated(+md[1], +md[2])
      const [number, title, speaker] = [row[1], row[2], row[3]].map(v => (v ?? '').trim())
      if (inWeek(date) && (title || speaker)) talks.push({ date, number, title, speaker })
      continue
    }
    const full = first.match(/^(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})日\s*(?:[（(][^）)]*[）)])?\s*/)
    if (full && rest) {
      if (full[1]) { year = Number(full[1]) }
      const date = dated(+full[2], +full[3])
      const title = first.slice(full[0].length).trim() || first
      if (inWeek(date)) events.push({ date, number: '', title, speaker: '' })
    }
  }
  return talks.length ? talks : events
}

function shortDate(date: string) {
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${weekday}）`
}

export function reminderText(talks: PublicTalkEntry[], monday: string, sunday: string) {
  if (!talks.length) return null
  const lines = [`公眾演講提醒（${shortDate(monday)}～${shortDate(sunday)}）`]
  for (const talk of talks) {
    lines.push('')
    if (!talk.speaker && !/^\d+$/.test(talk.number)) {
      lines.push(`${shortDate(talk.date)}：${talk.title}`)
      continue
    }
    lines.push(`${shortDate(talk.date)} 公眾演講`)
    lines.push(`講題：${[/^\d+$/.test(talk.number) ? talk.number : '', talk.title].filter(Boolean).join(' ') || '未填'}`)
    lines.push(`講者：${talk.speaker || '尚未安排'}`)
  }
  return lines.join('\n')
}

export async function fetchPublicTalkRows() {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${PUBLIC_TALK_SHEET_ID}/export?format=csv&gid=0`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`公眾演講秩序表讀取失敗（HTTP ${response.status}）`)
  return parseCsv(await response.text())
}

export async function buildWeekReminder(now = new Date()) {
  const { monday, sunday } = taipeiWeek(now)
  const talks = findWeekTalks(await fetchPublicTalkRows(), monday, sunday)
  return { monday, sunday, talks, text: reminderText(talks, monday, sunday) }
}

function stableId(key: string) {
  const hex = createHash('sha256').update(key).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** 每週一排程：同一週同一人只排一次（固定 id），重跑只會補發未送達的 */
export async function sendPublicTalkReminders(db: PrismaClient, now = new Date()) {
  const settings = await readReminderSettings(db)
  if (!settings.enabled) return { skipped: 'disabled' as const }
  if (!lineBotReady()) return { skipped: 'line_disabled' as const }
  const week = await buildWeekReminder(now)
  if (!week.text) return { skipped: 'no_talk' as const, week: week.monday }
  const members = await db.member.findMany({ where: { id: { in: settings.memberIds }, active: true, deletedAt: null, lineuid: { not: null }, lineNotificationsEnabled: true }, select: { id: true, lineuid: true } })
  const data = members.map(member => ({ id: stableId(`public-talk:${week.monday}:${member.id}`), memberId: member.id, lineUid: member.lineuid!, text: week.text!, nextAttemptAt: now, expiresAt: new Date(now.getTime() + 23 * 3600000) }))
  const queued = data.length ? (await db.lineNotification.createMany({ data, skipDuplicates: true })).count : 0
  const delivery = data.length ? await drainLineNotifications(db, data.map(d => d.id), now, 250) : null
  await writeReminderSettings(db, { ...(await readReminderSettings(db)), lastRun: { week: week.monday, queued, at: now.toISOString() } })
  return { week: week.monday, recipients: data.length, queued, delivery }
}
