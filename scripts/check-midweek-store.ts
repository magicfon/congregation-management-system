import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { parseWeek } from '../src/lib/midweek-import'
import { MeetingConflict, MeetingError, newMeeting } from '../src/lib/midweek'
import { editMeeting, getRecord, meetingList, SOURCE_PREFIX } from '../src/lib/midweek-store'
import { GET as publicMeeting } from '../src/app/api/midweek/route'

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
  const hiddenResponse = await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))
  assert.equal(hiddenResponse.status,404,'下架後不能透過公開 API 讀取歷史')
  assert.equal((await getRecord(source.id))?.versions?.length, 1, '下架不刪除歷史')
  await editMeeting(source.id, 'publish', 6, draft)
  const version2 = await getRecord(source.id)
  assert.equal(version2?.versions?.length, 2)
  assert.equal(version2?.versions?.[0].meeting.chair, '測試主席')
  assert.equal(version2?.versions?.[1].marks.chair, 2)
  await assert.rejects(editMeeting(source.id, 'publish', 7, draft), /沒有變更/)
  const modified = structuredClone(draft); modified.chair = '新版主席'
  const publishes = await Promise.allSettled([editMeeting(source.id, 'publish', 7, modified), editMeeting(source.id, 'publish', 7, modified)])
  assert.equal(publishes.filter(r=>r.status==='fulfilled').length, 1, '並行發布只有一筆成功')
  assert.deepEqual((await getRecord(source.id))?.versions?.map(v=>v.number), [1,2,3])
  const visible = await (await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).json()
  assert.equal(visible.versions.length,3)
  assert.equal(visible.draft,undefined,'公開 API 不回傳草稿')
  await assert.rejects(editMeeting(source.id, 'version-date', 8, { number:3,date:'2026-10-01' }), /只能補填/)
  const beforeRestore = (await getRecord(source.id))!
  for (const number of [0, -1, 1.5, 999, '1', undefined]) {
    await assert.rejects(editMeeting(source.id, 'restore', 8, { number }), MeetingError)
  }
  assert.deepEqual(await getRecord(source.id), beforeRestore, '無效版號不可修改資料')
  await assert.rejects(editMeeting(source.id, 'restore', 7, { number: 1 }), MeetingConflict)
  const restored = await editMeeting(source.id, 'restore', 8, { number: 1 })
  assert.deepEqual(restored.record.draft, beforeRestore.versions![0].meeting, '完整還原指定快照到草稿')
  assert.deepEqual(restored.record.published, beforeRestore.published, '退回草稿不更改公開內容')
  assert.equal(restored.record.publishedAt, beforeRestore.publishedAt)
  assert.deepEqual(restored.record.versions, beforeRestore.versions, '退回不更改歷史與日期')
  const publicAfterRestore = await (await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).json()
  assert.equal(publicAfterRestore.meeting.chair, '新版主席')
  const republished = await editMeeting(source.id, 'publish', 9, restored.record.draft)
  assert.deepEqual(republished.record.versions?.map(v => v.number), [1, 2, 3, 4], '還原內容發布後建立遞增版號')
  assert.equal(republished.record.versions?.at(-1)?.marks.chair, 4, '相對最新版本重新計算還原欄位高亮')
  assert.deepEqual(republished.record.versions?.slice(0, 3), beforeRestore.versions, '發布後歷史仍完整保留')
  const concurrentRestores = await Promise.allSettled([
    editMeeting(source.id, 'restore', 10, { number: 2 }),
    editMeeting(source.id, 'restore', 10, { number: 3 }),
  ])
  assert.equal(concurrentRestores.filter(r => r.status === 'fulfilled').length, 1, '並行退回只能一筆成功')
  assert.ok(concurrentRestores.some(r => r.status === 'rejected' && r.reason instanceof MeetingConflict))
  await editMeeting(source.id, 'restore', 11, { number: 4 })
  await assert.rejects(editMeeting(source.id, 'publish', 12, republished.record.draft), /沒有變更/, '退回最新版本且無變更不增版')
  await editMeeting(source.id, 'unpublish', 12)
  const hiddenRestore = await editMeeting(source.id, 'restore', 13, { number: 2 })
  assert.equal(hiddenRestore.record.published, null, '退回下架週次仍保持下架')
  assert.equal(hiddenRestore.record.versions?.length, 4)
  assert.equal((await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).status, 404)
  console.log('週中節目：退回草稿、歷史保留、發布遞增與高亮、無效版號及並行退回檢查通過')
  console.log('週中節目：草稿隔離、發布快照、競爭更新、來源更新、重建與下架檢查通過')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
