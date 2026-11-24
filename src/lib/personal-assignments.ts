import type { PrismaClient } from '@prisma/client'
import { taipeiDate } from './google-sheets'
import { addDays, serviceRoles, type Assignments } from './service-roster'
import { isCancelled, type MeetingRecord } from './midweek'
import { datedPublicTalkRows, fetchPublicTalkRows } from './public-talk-reminder'

export type AssignmentKind = 'service' | 'program'
export type PersonalAssignment = { kind: AssignmentKind; id: string; date: string; endDate: string; category: string; title: string; role: string; href: string }
export type PersonalAssignments = { showBrotherService: boolean; weekStart: string; weekEnd: string; upcoming: PersonalAssignment[]; past: PersonalAssignment[]; notices: string[] }

// 公眾演講秩序表欄位：日期、編號、講題、講者、主席、守（主持人只寫姓）、誦讀。ADR-0147
const TALK_COL = { number: 1, title: 2, speaker: 3, chair: 4, reader: 6 } as const
// 外地講者寫成「姓名（會眾）A」，只取括號前的姓名比對
function sheetName(cell: string | undefined) { return (cell ?? '').trim().replace(/[（(].*$/, '').trim() }

export async function personalAssignments(db: PrismaClient, memberId: string, now = new Date(), loadTalkRows: () => Promise<string[][]> = fetchPublicTalkRows): Promise<PersonalAssignments> {
  const [members, person, weeks, records, talkRows] = await Promise.all([
    db.member.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true, gender: true } }),
    db.servicePerson.findUnique({ where: { memberId }, select: { id: true } }),
    db.serviceWeek.findMany({ where: { stopped: false }, orderBy: { startDate: 'asc' } }),
    db.setting.findMany({ where: { key: { startsWith: 'midweek:record:' } } }),
    loadTalkRows().catch(() => null),
  ])
  const today = taipeiDate(now)
  const monday = addDays(today, -((new Date(`${today}T04:00:00Z`).getUTCDay() + 6) % 7))
  const sunday = addDays(monday, 6)
  const member = members.find(m => m.id === memberId)
  if (!member) return { showBrotherService: false, weekStart: monday, weekEnd: sunday, upcoming: [], past: [], notices: [] }
  const showBrotherService = member.gender !== 'sister'
  const name = member.name.trim()
  const uniqueName = !!name && members.filter(m => m.name.trim() === name).length === 1
  const notices = []
  if (!uniqueName) notices.push('週中節目姓名無法唯一對應，請管理員確認成員姓名。')
  if (!person && showBrotherService) notices.push('帳號尚未連結服務安排人員，請管理員確認。')
  const entries: PersonalAssignment[] = []
  for (const week of weeks) {
    if (week.stopped || !person) continue
    const assignments = week.assignments as Assignments
    for (const role of serviceRoles) if (assignments[role.id]?.personId === person.id) {
      entries.push({ kind: ['watchtower', 'chair', 'reader'].includes(role.id) ? 'program' : 'service', id: `service:${week.startDate}:${role.id}`, date: week.startDate, endDate: week.endDate, category: '服務安排', title: role.label, role: '', href: '/bulletin/service-roster/all?tab=mine' })
    }
  }
  if (uniqueName) for (const row of records) {
    const meeting = (JSON.parse(row.value) as MeetingRecord).published
    if (!meeting || isCancelled(meeting)) continue
    const href = `/bulletin/midweek-meeting?week=${encodeURIComponent(row.key.slice('midweek:record:'.length))}`
    const add = (id: string, title: string, role: string) => entries.push({ kind: 'program', id: `${row.key}:${id}`, date: meeting.date, endDate: meeting.date, category: '週中聚會', title, role, href })
    if (meeting.chair.trim() === name) add('chair', '主席', '')
    for (const item of meeting.items) {
      if (item.person.trim() === name) add(`${item.id}:person`, item.title, item.role === '學生/助手' ? '學生' : item.role || '負責人')
      if (item.assistant.trim() === name) add(`${item.id}:assistant`, item.title, '助手')
    }
  }
  if (uniqueName && talkRows) for (const row of datedPublicTalkRows(talkRows, monday)) {
    if (row.kind !== 'talk') continue
    const cells = row.row
    const add = (id: string, title: string, role: string) => entries.push({ kind: 'program', id: `talk:${row.date}:${id}`, date: row.date, endDate: row.date, category: '週末聚會', title, role, href: '/bulletin/public-talks' })
    if (sheetName(cells[TALK_COL.speaker]) === name) {
      const number = (cells[TALK_COL.number] ?? '').trim()
      add('speaker', ['公眾演講', /^\d+$/.test(number) ? number : '', (cells[TALK_COL.title] ?? '').trim()].filter(Boolean).join(' '), '講者')
    }
    if (sheetName(cells[TALK_COL.chair]) === name) add('chair', '週末聚會主席', '')
    // 服務安排已排同一週守望台朗讀時不重複列
    const rosterReader = entries.some(item => item.id.endsWith(':watchtower') && item.date <= row.date && item.endDate >= row.date)
    if (sheetName(cells[TALK_COL.reader]) === name && !rosterReader) add('reader', '守望台誦讀', '')
  }
  if (!talkRows) notices.push('公眾演講秩序表暫時讀不到，週末聚會的講者、主席、誦讀委派可能沒有列出。')
  const isUpcoming = (item: PersonalAssignment) => item.category === '服務安排' ? item.endDate >= today : item.date >= monday
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const visible = entries.filter(item => showBrotherService || item.kind === 'program')
  return { showBrotherService, weekStart: monday, weekEnd: sunday, upcoming: visible.filter(isUpcoming), past: visible.filter(item => !isUpcoming(item)).reverse(), notices }
}

// LINE 會把 2026-11-15、11/15、11-15 這類寫法自動變成超連結，私訊改用「11月15日（日）」。
export function lineDate(date: string): string {
  const [, month, day] = date.split('-').map(Number)
  const weekday = '日一二三四五六'[new Date(`${date}T04:00:00Z`).getUTCDay()]
  return `${month}月${day}日（${weekday}）`
}

export function assignmentsText(data: PersonalAssignments): string {
  const sections = ([['service', '弟兄服務'], ['program', '節目委派']] as const).filter(([kind]) => data.showBrotherService || kind === 'program').map(([kind, label]) => {
    const items = data.upcoming.filter(item => item.kind === kind)
    let text = `【${data.showBrotherService ? label : '我的委派'}】本週起 · ${items.length} 項`
    let count = 0
    for (const item of items) {
      const line = `\n• ${lineDate(item.date)}${item.endDate !== item.date ? `～${lineDate(item.endDate)}` : ''}｜${item.category}｜${item.title}${item.role ? `（${item.role}）` : ''}`
      if (text.length + line.length > 1750) break
      text += line; count++
    }
    if (!items.length) text += '\n目前沒有本週及未來已公布的委派。'
    if (count < items.length) text += `\n另有 ${items.length - count} 項，請至網站查看。`
    return text
  })
  return `我的委派\n${sections.join('\n\n')}${data.notices.length ? `\n\n${data.notices.join('\n')}` : ''}\n\n完整委派與過去紀錄請至網站「我的看板」查看。`
}
