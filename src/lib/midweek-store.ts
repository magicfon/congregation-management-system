import { prisma } from './db'
import { MeetingConflict, MeetingError, newMeeting, validateMeeting, type MeetingRecord, type SourceWeek } from './midweek'
import { localDate, previewVersion, sameContent, validatePalette, versionsOf } from './midweek-versions'

const PALETTE_KEY = 'midweek:palette'
export async function getPalette() {
  const row = await prisma.setting.findUnique({ where: { key: PALETTE_KEY } })
  return row ? validatePalette(JSON.parse(row.value)) : {}
}
export async function savePalette(value: unknown) {
  const palette = validatePalette(value)
  await prisma.setting.upsert({ where: { key: PALETTE_KEY }, create: { key: PALETTE_KEY, value: JSON.stringify(palette) }, update: { value: JSON.stringify(palette) } })
  return palette
}

export const SOURCE_PREFIX = 'midweek:source:'
export const RECORD_PREFIX = 'midweek:record:'
export async function getSource(id: string) {
  const row = await prisma.setting.findUnique({ where: { key: SOURCE_PREFIX + id } })
  if (!row) throw new MeetingError('找不到這週的手冊，請先匯入')
  return JSON.parse(row.value) as SourceWeek
}
export async function getRecord(id: string) {
  const row = await prisma.setting.findUnique({ where: { key: RECORD_PREFIX + id } })
  if (!row) return null
  const record = JSON.parse(row.value) as MeetingRecord
  return { ...record, versions: versionsOf(record) }
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
  if (!/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(revision) || revision < 0 || !['save', 'publish', 'unpublish', 'reset', 'version-date'].includes(action)) throw new MeetingError('操作格式錯誤')
  const source = await getSource(id)
  const key = RECORD_PREFIX + id
  const oldRow = await prisma.setting.findUnique({ where: { key } })
  const old: MeetingRecord = oldRow ? JSON.parse(oldRow.value) : { revision: 0, sourceHash: source.hash, draft: newMeeting(source), published: null, publishedAt: null }
  if (old.revision !== revision) throw new MeetingConflict()
  const versions = versionsOf(old)
  const draft = action === 'reset' ? newMeeting(source) : ['unpublish', 'version-date'].includes(action) ? old.draft : validateMeeting(value)
  if (action === 'publish' && old.published && versions.length && sameContent(draft, versions.at(-1)!.meeting)) throw new MeetingError('沒有變更，不需發布新版')
  const next: MeetingRecord = { ...old, versions, revision: revision + 1, draft, sourceHash: action === 'reset' || !oldRow ? source.hash : old.sourceHash }
  if (action === 'version-date') {
    const input = value as { number?: number; date?: string }
    const allowed = new Set(versions.flatMap(v => [v.number, ...Object.values(v.marks)]))
    if (!input || !Number.isInteger(input.number) || !allowed.has(input.number!) || typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0,10) !== input.date || versions.some(v => v.number === input.number && v.date)) throw new MeetingError('只能補填既有版本的日期')
    next.versionDates = { ...old.versionDates, [input.number!]: input.date }
  }
  if (action === 'publish') {
    const previous = versions.at(-1)
    // Re-publishing an unchanged, withdrawn snapshot restores visibility without a duplicate version.
    if (!previous || !sameContent(draft, previous.meeting)) next.versions = [...versions, { ...previewVersion(draft, previous), date: localDate() }]
    next.published = structuredClone(draft); next.publishedAt = new Date().toISOString()
  }
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
