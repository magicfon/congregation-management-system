import { botSite, lineBotReady, lineRequest } from './line-bot-client'
import type { PrismaClient } from '@prisma/client'
import { displayDate } from './student-notice-text'
import { MeetingError, type Meeting, type MeetingItem, type MeetingRecord } from './midweek'

// S-89-CH 學生練習通知單，以 LINE Flex 卡片呈現（ADR-0090）。
export type StudentNotice = { name: string; assistant: string; date: string; title: string; classNumber: 1 | 2 | 3; weekId: string; itemId?: string }
export type NoticeOptions = { preview?: boolean; updated?: boolean; ack?: string }
export const isStudentItem = (item: MeetingItem) => item.role === '學生' || item.role === '學生/助手'

export function studentNotices(weekId: string, meeting: Meeting): StudentNotice[] {
  return meeting.items.filter(item => isStudentItem(item) && item.person.trim()).map(item => ({ name: item.person.trim(), assistant: item.assistant.trim(), date: meeting.date, title: item.title.replace(/[[\]]/g, '').trim(), classNumber: 1, weekId, itemId: item.id }))
}

const ink = '#111111'
const field = (label: string, value: string) => ({ type: 'box', layout: 'horizontal', spacing: 'md', contents: [
  { type: 'text', text: label, weight: 'bold', size: 'md', flex: 0, color: ink },
  { type: 'text', text: value || '—', size: 'md', color: ink, wrap: true, flex: 1 },
] })
const separator = { type: 'separator', color: '#DDDDDD' }

export function studentNoticeFlex(notice: StudentNotice, options: NoticeOptions = {}) {
  const classes = ['第一班', '第二班', '第三班'].map((label, index) => {
    const checked = index + 1 === notice.classNumber
    return { type: 'text', text: `${checked ? '☑' : '☐'} ${label}`, size: 'md', color: checked ? ink : '#888888', weight: checked ? 'bold' : 'regular' }
  })
  return {
    type: 'flex',
    altText: `${options.preview ? '【樣式預覽】' : options.updated ? '【更新】' : ''}學生練習通知：${displayDate(notice.date)} ${notice.title}`.slice(0, 400),
    contents: {
      type: 'bubble', size: 'mega',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#BE8900', paddingAll: '14px', contents: [
        ...(options.preview || options.updated ? [{ type: 'text', text: options.preview ? '樣式預覽' : '更新：此通知取代先前收到的通知', size: 'xs', color: '#FFFFFFCC', wrap: true }] : []),
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
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        // 「收到」以 postback 回傳，系統記錄學生已確認。
        ...(options.ack ? [{ type: 'button', style: 'primary', color: '#BE8900', height: 'sm', action: { type: 'postback', label: '收到', data: options.ack, displayText: '收到' } }] : []),
        { type: 'button', style: options.ack ? 'secondary' : 'primary', ...(options.ack ? {} : { color: '#BE8900' }), height: 'sm', action: { type: 'uri', label: '查看節目表', uri: `${botSite}/bulletin/midweek-meeting${notice.weekId ? `?week=${encodeURIComponent(notice.weekId)}` : ''}` } },
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
    if (notice) return studentNoticeFlex(notice, { preview: true, ack: ACK_PREVIEW })
  }
  return studentNoticeFlex({ name: '林敬', assistant: '陳孟庭', date: '2026-05-29', title: '初次交談', classNumber: 1, weekId: '' }, { preview: true, ack: ACK_PREVIEW })
}

// 正式發送：發布後由管理員按鈕發送，只發新增或變動的人；被換掉的人收到取消訊息（ADR-0090）。
type SentEntry = { memberId: string; name: string; fingerprint: string; date: string; title: string; token?: string; confirmedAt?: string }
type SentLog = Record<string, SentEntry>
export type NoticePlanRow = { key: string; itemId: string; name: string; assistant: string; title: string; date: string; status: 'new' | 'updated' | 'cancel' | 'unchanged' | 'unreachable'; reason?: string; confirmedAt?: string }
const LOG_PREFIX = 'midweek:student-notices:'
const fingerprint = (notice: StudentNotice) => [notice.name, notice.assistant, notice.date, notice.title, notice.classNumber].join('|')

async function buildPlan(db: PrismaClient, weekId: string) {
  if (!/^[a-f0-9]{24}$/.test(weekId)) throw new MeetingError('操作格式錯誤')
  const [row, logRow, members] = await Promise.all([
    db.setting.findUnique({ where: { key: `midweek:record:${weekId}` } }),
    db.setting.findUnique({ where: { key: LOG_PREFIX + weekId } }),
    db.member.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true, lineuid: true, lineNotificationsEnabled: true } }),
  ])
  const meeting = row ? (JSON.parse(row.value) as MeetingRecord).published : null
  if (!meeting) throw new MeetingError('這週尚未發布，發布後才能發送通知單')
  const log: SentLog = logRow ? JSON.parse(logRow.value) : {}
  const send: { key: string; notice: StudentNotice; updated: boolean; member: { id: string; lineuid: string } }[] = []
  const cancels: { key: string; entry: SentEntry; lineuid: string | null }[] = []
  const rows: NoticePlanRow[] = []
  const current = new Set<string>()
  // 被換掉或移除的人：可聯絡就發取消訊息，否則只列出由管理員自行告知。
  const cancelRow = (key: string, entry: SentEntry): NoticePlanRow => {
    const old = members.find(m => m.id === entry.memberId)
    const lineuid = old?.lineuid && old.lineNotificationsEnabled ? old.lineuid : null
    cancels.push({ key, entry, lineuid })
    return { key: `${key}:cancel`, itemId: key.slice(0, key.lastIndexOf(':')), name: entry.name, assistant: '', title: entry.title.replace(/[[\]]/g, ''), date: entry.date, status: 'cancel', ...(lineuid ? {} : { reason: '無法用 LINE 通知，請自行告知' }) }
  }
  // 只發給學生本人，助手不發（ADR-0090）。
  for (const notice of studentNotices(weekId, meeting)) {
    const key = `${notice.itemId}:student`
    current.add(key)
    const matches = members.filter(m => m.name.trim() === notice.name)
    const member = matches.length === 1 ? matches[0] : null
    const previous = log[key]
    const base = { key, itemId: notice.itemId!, name: notice.name, assistant: notice.assistant, title: notice.title, date: notice.date }
    if (previous && previous.memberId === member?.id && previous.fingerprint.replace(/[[\]]/g, '') === fingerprint(notice)) { rows.push({ ...base, status: 'unchanged', ...(previous.confirmedAt ? { confirmedAt: previous.confirmedAt } : {}) }); continue }
    if (previous && previous.memberId !== member?.id) rows.push(cancelRow(key, previous))
    const reason = !member ? (matches.length ? '成員姓名重複' : '找不到成員') : !member.lineuid ? '未綁定 LINE' : !member.lineNotificationsEnabled ? '已關閉 LINE 通知' : ''
    if (reason) { rows.push({ ...base, status: 'unreachable', reason }); continue }
    const updated = !!previous && previous.memberId === member!.id
    send.push({ key, notice, updated, member: { id: member!.id, lineuid: member!.lineuid! } })
    rows.push({ ...base, status: updated ? 'updated' : 'new' })
  }
  // 先前發給助手的紀錄不再追蹤，也不發取消。
  for (const [key, entry] of Object.entries(log)) if (!current.has(key) && !key.endsWith(':assistant')) rows.push(cancelRow(key, entry))
  return { rows, send, cancels, log }
}

export async function studentNoticePlan(db: PrismaClient, weekId: string) {
  return (await buildPlan(db, weekId)).rows
}

export async function sendStudentNotices(db: PrismaClient, weekId: string) {
  if (!lineBotReady()) throw new MeetingError('LINE 官方帳號尚未啟用')
  const { send, cancels, log } = await buildPlan(db, weekId)
  const next: SentLog = { ...log }
  let sent = 0, failed = 0
  for (const job of cancels) {
    if (!job.lineuid) { if (next[job.key]?.memberId === job.entry.memberId) delete next[job.key]; continue }
    const text = `【學生練習取消】\n${displayDate(job.entry.date)} ${job.entry.title.replace(/[[\]]/g, '')} 的委派已取消，請以最新節目表為準。\n${botSite}/bulletin/midweek-meeting?week=${encodeURIComponent(weekId)}`
    const result = await lineRequest('push', { to: job.lineuid, messages: [{ type: 'text', text }] }).catch(() => ({ accepted: false }))
    if (result.accepted) { if (next[job.key]?.memberId === job.entry.memberId) delete next[job.key]; sent++ } else failed++
  }
  for (const job of send) {
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const ack = [ACK_PREFIX, weekId, job.key, token].join('|')
    const result = await lineRequest('push', { to: job.member.lineuid, messages: [studentNoticeFlex(job.notice, { updated: job.updated, ack })] }).catch(() => ({ accepted: false }))
    if (result.accepted) { next[job.key] = { memberId: job.member.id, name: job.notice.name, fingerprint: fingerprint(job.notice), date: job.notice.date, title: job.notice.title, token }; sent++ } else failed++
  }
  // 發送期間學生可能已按「收到」，保留同一張通知的確認。
  const latest = await db.setting.findUnique({ where: { key: LOG_PREFIX + weekId } })
  if (latest) for (const [key, entry] of Object.entries(JSON.parse(latest.value) as SentLog)) if (entry.confirmedAt && next[key]?.token === entry.token) next[key].confirmedAt = entry.confirmedAt
  await db.setting.upsert({ where: { key: LOG_PREFIX + weekId }, create: { key: LOG_PREFIX + weekId, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } })
  return { sent, failed, rows: (await buildPlan(db, weekId)).rows }
}

// 學生按卡片上的「收到」：只接受該張通知收件人本人、且是最新一張通知。
const ACK_PREFIX = 'notice-ack'
const ACK_PREVIEW = `${ACK_PREFIX}|preview`
export const isNoticeAck = (data: unknown): data is string => typeof data === 'string' && data.startsWith(`${ACK_PREFIX}|`)
export async function acknowledgeNotice(db: PrismaClient, lineUid: string, data: string, now = new Date()) {
  if (data === ACK_PREVIEW) return '這是樣式預覽，學生按「收到」後，發送名單會顯示「已確認」。'
  const [, weekId, key, token] = data.split('|')
  if (!weekId || !key || !token || !/^[a-f0-9]{24}$/.test(weekId)) return '無法辨識這張通知。'
  const [row, member] = await Promise.all([
    db.setting.findUnique({ where: { key: LOG_PREFIX + weekId } }),
    db.member.findFirst({ where: { lineuid: lineUid, active: true, deletedAt: null }, select: { id: true } }),
  ])
  const log: SentLog = row ? JSON.parse(row.value) : {}
  const entry = log[key]
  if (!entry || entry.token !== token) return '這張通知已有更新或已取消，請以最新收到的通知為準。'
  if (entry.memberId !== member?.id) return '這張通知不是發給你的帳號。'
  if (!entry.confirmedAt) {
    entry.confirmedAt = now.toISOString()
    await db.setting.update({ where: { key: LOG_PREFIX + weekId }, data: { value: JSON.stringify(log) } })
  }
  return `已確認收到 ${displayDate(entry.date)} ${entry.title.replace(/[[\]]/g, '')}，謝謝！`
}
