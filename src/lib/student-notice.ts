import { botSite } from './line-bot-client'
import type { PrismaClient } from '@prisma/client'
import type { Meeting, MeetingItem, MeetingRecord } from './midweek'

// S-89-CH 學生練習通知單，以 LINE Flex 卡片呈現（ADR-0090）。
export type StudentNotice = { name: string; assistant: string; date: string; title: string; classNumber: 1 | 2 | 3; weekId: string }
export const isStudentItem = (item: MeetingItem) => item.role === '學生' || item.role === '學生/助手'

export function studentNotices(weekId: string, meeting: Meeting): StudentNotice[] {
  return meeting.items.filter(item => isStudentItem(item) && item.person.trim()).map(item => ({ name: item.person.trim(), assistant: item.assistant.trim(), date: meeting.date, title: item.title, classNumber: 1, weekId }))
}

const weekday = ['日', '一', '二', '三', '四', '五', '六']
const displayDate = (date: string) => `${Number(date.slice(0, 4))}/${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（週${weekday[new Date(`${date}T12:00:00Z`).getUTCDay()]}）`
const ink = '#111111'
const field = (label: string, value: string) => ({ type: 'box', layout: 'horizontal', spacing: 'md', contents: [
  { type: 'text', text: label, weight: 'bold', size: 'md', flex: 0, color: ink },
  { type: 'text', text: value || '—', size: 'md', color: ink, wrap: true, flex: 1 },
] })
const separator = { type: 'separator', color: '#DDDDDD' }

export function studentNoticeFlex(notice: StudentNotice, options: { preview?: boolean } = {}) {
  const classes = ['第一班', '第二班', '第三班'].map((label, index) => {
    const checked = index + 1 === notice.classNumber
    return { type: 'text', text: `${checked ? '☑' : '☐'} ${label}`, size: 'md', color: checked ? ink : '#888888', weight: checked ? 'bold' : 'regular' }
  })
  return {
    type: 'flex',
    altText: `${options.preview ? '【樣式預覽】' : ''}學生練習通知：${displayDate(notice.date)} ${notice.title}`.slice(0, 400),
    contents: {
      type: 'bubble', size: 'mega',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#BE8900', paddingAll: '14px', contents: [
        ...(options.preview ? [{ type: 'text', text: '樣式預覽', size: 'xs', color: '#FFFFFFCC' }] : []),
        { type: 'text', text: '傳道與生活聚會學生練習通知', weight: 'bold', size: 'lg', color: '#FFFFFF', wrap: true },
      ] },
      body: { type: 'box', layout: 'vertical', spacing: 'md', backgroundColor: '#FFFFFF', contents: [
        field('姓名：', notice.name), separator,
        field('助手：', notice.assistant), separator,
        field('日期：', displayDate(notice.date)), separator,
        field('節目：', notice.title), separator,
        { type: 'text', text: '受訓班別：', weight: 'bold', size: 'md', color: ink },
        { type: 'box', layout: 'vertical', paddingStart: '12px', spacing: 'xs', contents: classes },
        { type: 'text', text: '學生注意：《傳道與生活聚會手冊》裡提供了學生練習的資料來源和學習要點。請查看《傳道與生活聚會指示》（S-38）中關於學生練習的指示。', size: 'xs', color: '#555555', wrap: true, margin: 'lg' },
        { type: 'text', text: 'S-89-CH', size: 'xxs', color: '#999999' },
      ] },
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'button', style: 'primary', color: '#BE8900', height: 'sm', action: { type: 'uri', label: '查看節目表', uri: `${botSite}/bulletin/midweek-meeting${notice.weekId ? `?week=${encodeURIComponent(notice.weekId)}` : ''}` } },
      ] },
    },
  }
}

// LINE 輸入「通知單樣式」時回覆的預覽：取最近一週已發布節目的第一位學生，沒有就用範例（ADR-0090）。
export async function studentNoticeSample(db: PrismaClient, today: string) {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'midweek:record:' } } })
  const weeks = rows.map(row => ({ id: row.key.slice('midweek:record:'.length), meeting: (JSON.parse(row.value) as MeetingRecord).published }))
    .filter((week): week is { id: string; meeting: Meeting } => !!week.meeting && week.meeting.date >= today)
    .sort((a, b) => a.meeting.date.localeCompare(b.meeting.date))
  for (const week of weeks) {
    const notice = studentNotices(week.id, week.meeting)[0]
    if (notice) return studentNoticeFlex(notice, { preview: true })
  }
  return studentNoticeFlex({ name: '林敬', assistant: '陳孟庭', date: '2026-05-29', title: '初次交談', classNumber: 1, weekId: '' }, { preview: true })
}
