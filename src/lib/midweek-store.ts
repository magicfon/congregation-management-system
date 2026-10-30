import { prisma } from './db'
import { MeetingConflict, MeetingError, newMeeting, validateMeeting, type MeetingRecord, type SourceWeek } from './midweek'
import { draftBaseVersionOf, draftOwnerStale, localDate, previewVersion, publishedVersionOf, sameContent, validatePalette, versionsOf } from './midweek-versions'

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
export type Editor = { id: string; name: string }
export async function editMeeting(id: string, action: string, revision: number, value?: unknown, options: { deleteLaterVersions?: unknown; editor?: Editor } = {}) {
  if (!/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(revision) || revision < 0 || !['save', 'publish', 'unpublish', 'reset', 'restore', 'delete-later', 'version-date', 'discard', 'take-over'].includes(action)) throw new MeetingError('操作格式錯誤')
  const editor = options.editor ?? { id: '', name: '' }
  const source = await getSource(id)
  const key = RECORD_PREFIX + id
  const oldRow = await prisma.setting.findUnique({ where: { key } })
  const old: MeetingRecord = oldRow ? JSON.parse(oldRow.value) : { revision: 0, sourceHash: source.hash, draft: newMeeting(source), published: null, publishedAt: null }
  if (old.revision !== revision) throw new MeetingConflict()
  const versions = versionsOf(old)
  const owner = old.draftOwner && old.draftOwner.id !== editor.id ? old.draftOwner : undefined
  if (action === 'take-over') {
    if (!owner) throw new MeetingError('目前沒有別人的草稿需要接手')
    if (!draftOwnerStale(owner)) throw new MeetingError(`${owner.name}的草稿還不到24小時，請先聯絡他`)
  } else if (owner && action !== 'unpublish') throw new MeetingError(`${owner.name}正在編輯草稿，等他發布或放棄後才能編輯`)
  let restored: MeetingRecord['draft'] | undefined
  if (action === 'restore') {
    const number = (value as { number?: unknown } | null)?.number
    const version = Number.isInteger(number) ? versions.find(v => v.number === number) : undefined
    if (!version) throw new MeetingError('找不到已保存的版次，請重新選擇')
    restored = structuredClone(version.meeting)
  }
  // 放棄草稿：回到公開版（已下架則回到最後保存的版次），沒有任何版次就回到手冊原稿。
  const discardTo = action === 'discard' ? publishedVersionOf(old) : undefined
  if (action === 'discard') restored = discardTo ? structuredClone(discardTo.meeting) : newMeeting(source)
  const draft = restored ?? (action === 'reset' ? newMeeting(source) : ['unpublish', 'delete-later', 'version-date', 'take-over'].includes(action) ? old.draft : validateMeeting(value))
  const next: MeetingRecord = { ...old, versions, revision: revision + 1, draft, sourceHash: action === 'reset' || !oldRow ? source.hash : old.sourceHash }
  if (action === 'restore') next.draftBaseVersion = (value as { number: number }).number
  if (action === 'discard') next.draftBaseVersion = discardTo?.number
  if (['save', 'restore', 'reset', 'take-over'].includes(action)) {
    // 草稿與公開版完全相同（改回原樣）就不鎖定，其餘儲存都記下編輯者。
    const base = draftBaseVersionOf(next), published = old.published ? publishedVersionOf(old) : undefined
    const untouched = base && published && base.number === published.number && sameContent(draft, base.meeting)
    if (untouched && action !== 'take-over') delete next.draftOwner
    else next.draftOwner = { id: editor.id, name: editor.name, at: new Date().toISOString() }
  }
  if (action === 'discard') delete next.draftOwner
  if (action === 'delete-later') {
    const base = draftBaseVersionOf(old)
    if (!base || !versions.some(version => version.number > base.number)) throw new MeetingError('沒有後續版本可刪除')
    if (options.deleteLaterVersions !== true) throw new MeetingError('請先確認刪除後續版本')
    if (old.published && publishedVersionOf(old)!.number > base.number) throw new MeetingError(`請先發布第${base.number}版，再刪除後續版本`)
    next.versions = versions.filter(version => version.number <= base.number)
    next.versionDates = Object.fromEntries(Object.entries(old.versionDates || {}).filter(([number]) => Number(number) <= base.number))
    if (!old.published) next.publishedVersion = base.number
  }
  if (action === 'version-date') {
    const input = value as { number?: number; date?: string }
    const allowed = new Set(versions.flatMap(v => [v.number, ...Object.values(v.marks)]))
    if (!input || !Number.isInteger(input.number) || !allowed.has(input.number!) || typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0,10) !== input.date || versions.some(v => v.number === input.number && v.date)) throw new MeetingError('只能補填既有版本的日期')
    next.versionDates = { ...old.versionDates, [input.number!]: input.date }
  }
  if (action === 'publish') {
    const previous = draftBaseVersionOf(old)
    const changed = !previous || !sameContent(draft, previous.meeting)
    if (!changed && old.published && publishedVersionOf(old)?.number === previous.number) throw new MeetingError('沒有變更，不需發布新版')
    if (changed) {
      const later = previous ? versions.filter(version => version.number > previous.number) : []
      if (later.length && options.deleteLaterVersions !== true) throw new MeetingError('進版前需確認刪除後續版本')
      const kept = previous ? versions.filter(version => version.number <= previous.number) : []
      const version = { ...previewVersion(draft, previous), date: localDate(), ...(editor.name ? { by: editor.name } : {}) }
      next.versions = [...kept, version]
      next.publishedVersion = version.number
      if (later.length) next.versionDates = Object.fromEntries(Object.entries(old.versionDates || {}).filter(([number]) => Number(number) <= previous!.number))
    } else {
      next.publishedVersion = previous.number
    }
    next.draftBaseVersion = next.publishedVersion
    next.published = structuredClone(draft); next.publishedAt = new Date().toISOString()
    delete next.draftOwner
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
