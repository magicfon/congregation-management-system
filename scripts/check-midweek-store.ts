import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { parseWeek } from '../src/lib/midweek-import'
import { MeetingConflict, newMeeting } from '../src/lib/midweek'
import { editMeeting, getRecord, meetingList, SOURCE_PREFIX } from '../src/lib/midweek-store'

// In-memory database boundary: these tests never connect to the live database.
const rows = new Map<string, { key: string; value: string }>()
const table = {
  findUnique: async ({ where }: any) => rows.has(where.key) ? { ...rows.get(where.key)! } : null,
  findMany: async ({ where }: any) => [...rows.values()].filter(r => r.key.startsWith(where.key.startsWith)).map(r => ({ ...r })),
  create: async ({ data }: any) => { if (rows.has(data.key)) throw { code: 'P2002' }; rows.set(data.key, { ...data }); return data },
  updateMany: async ({ where, data }: any) => { if (rows.get(where.key)?.value !== where.value) return { count: 0 }; rows.set(where.key, { key: where.key, ...data }); return { count: 1 } },
}
for (const [key, value] of Object.entries(table)) (prisma.setting as any)[key] = value
async function main() {
  const source = parseWeek(readFileSync('scripts/fixtures/midweek/midweek-week.html', 'utf8'), 'https://www.jw.org/cmn-hant/多媒體圖書館/耶和華見證人聚會手冊/2026年/測試/')
  rows.set(SOURCE_PREFIX + source.id, { key: SOURCE_PREFIX + source.id, value: JSON.stringify(source) })
  const draft = newMeeting(source); draft.chair = '測試主席'
  await editMeeting(source.id, 'save', 0, draft)
  assert.equal((await meetingList(false)).length, 0, '草稿不可公開')
  await editMeeting(source.id, 'publish', 1, draft)
  draft.chair = '修改草稿'
  await editMeeting(source.id, 'save', 2, draft)
  assert.equal((await getRecord(source.id))?.published?.chair, '測試主席', '儲存草稿不可更改發布版本')
  await assert.rejects(editMeeting(source.id, 'save', 2, draft), MeetingConflict)
  const results = await Promise.allSettled([editMeeting(source.id, 'save', 3, draft), editMeeting(source.id, 'save', 3, draft)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, '同時保存僅一筆成功')
  source.hash = 'changed'; source.reading = '新版經文'
  rows.set(SOURCE_PREFIX + source.id, { key: SOURCE_PREFIX + source.id, value: JSON.stringify(source) })
  assert.equal((await getRecord(source.id))?.draft.chair, '修改草稿')
  await editMeeting(source.id, 'reset', 4)
  assert.equal((await getRecord(source.id))?.draft.reading, '新版經文')
  assert.equal((await getRecord(source.id))?.published?.chair, '測試主席')
  await editMeeting(source.id, 'unpublish', 5)
  assert.equal((await meetingList(false)).length, 0)
  console.log('週中節目：草稿隔離、發布快照、競爭更新、來源更新、重建與下架檢查通過')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
