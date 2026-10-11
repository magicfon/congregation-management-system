import { prisma } from './db'
import { MeetingConflict, MeetingError, newMeeting, validateMeeting, type MeetingRecord, type SourceWeek } from './midweek'

export const SOURCE_PREFIX = 'midweek:source:'
export const RECORD_PREFIX = 'midweek:record:'
export async function getSource(id: string) {
  const row = await prisma.setting.findUnique({ where: { key: SOURCE_PREFIX + id } })
  if (!row) throw new MeetingError('找不到這週的手冊，請先匯入')
  return JSON.parse(row.value) as SourceWeek
}
export async function getRecord(id: string) {
  const row = await prisma.setting.findUnique({ where: { key: RECORD_PREFIX + id } })
  return row ? JSON.parse(row.value) as MeetingRecord : null
}
export async function meetingList(management: boolean) {
  const records = await prisma.setting.findMany({ where: { key: { startsWith: RECORD_PREFIX } } })
  const byId = new Map(records.map(row => [row.key.slice(RECORD_PREFIX.length), JSON.parse(row.value) as MeetingRecord]))
  if (!management) return [...byId].filter(([, r]) => r.published).map(([id, r]) => ({ id, date: r.published!.date, reading: r.published!.reading, publishedAt: r.publishedAt })).sort((a, b) => b.date.localeCompare(a.date))
  const sources = await prisma.setting.findMany({ where: { key: { startsWith: SOURCE_PREFIX } } })
  return sources.map(row => {
    const s = JSON.parse(row.value) as SourceWeek, r = byId.get(s.id)
    return { id: s.id, week: s.week, date: r?.draft.date || newMeeting(s).date, reading: s.reading, label: s.label, revision: r?.revision || 0, publishedAt: r?.publishedAt, changedSource: Boolean(r && r.sourceHash !== s.hash) }
  }).sort((a, b) => b.week.localeCompare(a.week))
}
export async function editMeeting(id: string, action: string, revision: number, value?: unknown) {
  if (!/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(revision) || revision < 0 || !['save', 'publish', 'unpublish', 'reset'].includes(action)) throw new MeetingError('操作格式錯誤')
  const source = await getSource(id)
  const key = RECORD_PREFIX + id
  const oldRow = await prisma.setting.findUnique({ where: { key } })
  const old: MeetingRecord = oldRow ? JSON.parse(oldRow.value) : { revision: 0, sourceHash: source.hash, draft: newMeeting(source), published: null, publishedAt: null }
  if (old.revision !== revision) throw new MeetingConflict()
  const draft = action === 'reset' ? newMeeting(source) : action === 'unpublish' ? old.draft : validateMeeting(value)
  const next: MeetingRecord = { ...old, revision: revision + 1, draft, sourceHash: action === 'reset' || !oldRow ? source.hash : old.sourceHash }
  if (action === 'publish') { next.published = structuredClone(draft); next.publishedAt = new Date().toISOString() }
  if (action === 'unpublish') { next.published = null; next.publishedAt = null }
  if (oldRow) {
    const result = await prisma.setting.updateMany({ where: { key, value: oldRow.value }, data: { value: JSON.stringify(next) } })
    if (result.count !== 1) throw new MeetingConflict()
  } else {
    try { await prisma.setting.create({ data: { key, value: JSON.stringify(next) } }) }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new MeetingConflict(); throw error }
  }
  return { source, record: next }
}
