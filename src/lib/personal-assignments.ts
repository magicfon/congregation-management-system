import type { PrismaClient } from '@prisma/client'
import { taipeiDate } from './google-sheets'
import { addDays, serviceRoles, type Assignments } from './service-roster'
import type { MeetingRecord } from './midweek'

export type AssignmentKind = 'service' | 'program'
export type PersonalAssignment = { kind: AssignmentKind; id: string; date: string; endDate: string; category: string; title: string; role: string; href: string }
export type PersonalAssignments = { upcoming: PersonalAssignment[]; past: PersonalAssignment[]; notices: string[] }

export async function personalAssignments(db: PrismaClient, memberId: string, now = new Date()): Promise<PersonalAssignments> {
  const [members, person, weeks, records] = await Promise.all([
    db.member.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true } }),
    db.servicePerson.findUnique({ where: { memberId }, select: { id: true } }),
    db.serviceWeek.findMany({ where: { stopped: false }, orderBy: { startDate: 'asc' } }),
    db.setting.findMany({ where: { key: { startsWith: 'midweek:record:' } } }),
  ])
  const member = members.find(m => m.id === memberId)
  if (!member) return { upcoming: [], past: [], notices: [] }
  const name = member.name.trim()
  const uniqueName = !!name && members.filter(m => m.name.trim() === name).length === 1
  const notices = []
  if (!uniqueName) notices.push('週中節目姓名無法唯一對應，請管理員確認成員姓名。')
  if (!person) notices.push('帳號尚未連結服務安排人員，請管理員確認。')
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
    if (!meeting) continue
    const href = `/bulletin/midweek-meeting?week=${encodeURIComponent(row.key.slice('midweek:record:'.length))}`
    const add = (id: string, title: string, role: string) => entries.push({ kind: 'program', id: `${row.key}:${id}`, date: meeting.date, endDate: meeting.date, category: '週中聚會', title, role, href })
    if (meeting.chair.trim() === name) add('chair', '主席', '')
    for (const item of meeting.items) {
      if (item.person.trim() === name) add(`${item.id}:person`, item.title, item.role === '學生/助手' ? '學生' : item.role || '負責人')
      if (item.assistant.trim() === name) add(`${item.id}:assistant`, item.title, '助手')
    }
  }
  const today = taipeiDate(now)
  const monday = addDays(today, -((new Date(`${today}T04:00:00Z`).getUTCDay() + 6) % 7))
  const isUpcoming = (item: PersonalAssignment) => item.category === '服務安排' ? item.endDate >= today : item.date >= monday
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return { upcoming: entries.filter(isUpcoming), past: entries.filter(item => !isUpcoming(item)).reverse(), notices }
}

export function assignmentsText(data: PersonalAssignments, dashboardUrl: string): string {
  const base = new URL(dashboardUrl).origin
  const sections = ([['service', '弟兄服務'], ['program', '節目委派']] as const).map(([kind, label]) => {
    const items = data.upcoming.filter(item => item.kind === kind)
    let text = `【${label}】本週起 · ${items.length} 項`
    let count = 0
    for (const item of items) {
      const line = `\n• ${item.date}${item.endDate !== item.date ? `～${item.endDate}` : ''}｜${item.category}｜${item.title}${item.role ? `（${item.role}）` : ''}`
      if (text.length + line.length > 1750) break
      text += line; count++
    }
    if (!items.length) text += '\n目前沒有本週及未來已公布的委派。'
    if (count < items.length) text += `\n另有 ${items.length - count} 項，請至網站查看。`
    return `${text}\n${base}/dashboard/assignments/${kind}`
  })
  return `我的委派\n${sections.join('\n\n')}${data.notices.length ? `\n\n${data.notices.join('\n')}` : ''}\n\n完整委派與過去紀錄請開啟上述連結。`
}
