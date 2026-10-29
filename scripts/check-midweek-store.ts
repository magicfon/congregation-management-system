import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { parseWeek } from '../src/lib/midweek-import'
import { MeetingConflict, MeetingError, newMeeting } from '../src/lib/midweek'
import { editMeeting, getRecord, meetingList, SOURCE_PREFIX } from '../src/lib/midweek-store'
import { publishedVersionOf } from '../src/lib/midweek-versions'
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
  // Simulate a record written before explicit published version pointers existed.
  const legacy = (await getRecord(source.id))!
  delete legacy.publishedVersion
  legacy.versionDates = { 1: '2026-10-01', 2: '2026-10-02', 3: '2026-10-03' }
  const recordKey = `midweek:record:${source.id}`
  rows.set(recordKey, { key: recordKey, value: JSON.stringify(legacy) })
  const beforeUndo = (await getRecord(source.id))!
  assert.equal(publishedVersionOf(beforeUndo)?.number, 3, '舊資料預設最後發布版')
  for (const action of ['restore', 'delete-later']) await assert.rejects(editMeeting(source.id, action, 8, { number: 1 }), /操作格式錯誤/)
  for (const number of [undefined, 1, 2, 999, '3']) await assert.rejects(editMeeting(source.id, 'undo', 8, { number }), /只能撤回/)
  assert.deepEqual(await getRecord(source.id), beforeUndo, '撤回錯誤版號不可修改資料')
  await assert.rejects(editMeeting(source.id, 'undo', 7, { number: 3 }), MeetingConflict)
  const pending = structuredClone(beforeUndo.draft); pending.chair = '未發布的修改'
  await editMeeting(source.id, 'save', 8, pending)
  const undos = await Promise.allSettled([editMeeting(source.id, 'undo', 9, { number: 3 }), editMeeting(source.id, 'undo', 9, { number: 3 })])
  assert.equal(undos.filter(r => r.status === 'fulfilled').length, 1, '並行撤回只成功一次')
  const undone = (await getRecord(source.id))!
  assert.deepEqual(undone.versions, beforeUndo.versions!.slice(0, 2), '撤回只刪最新版')
  assert.deepEqual(undone.versionDates, { 1: '2026-10-01', 2: '2026-10-02' }, '撤回清掉該版補填日期')
  assert.equal(undone.publishedVersion, 2)
  assert.deepEqual(undone.published, beforeUndo.versions![1].meeting, '公布欄回到上一版')
  assert.deepEqual(undone.draft, beforeUndo.versions![1].meeting, '草稿回到上一版，捨棄未發布修改')
  const publicUndone = await (await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).json()
  assert.equal(publicUndone.publishedVersion, 2)
  assert.deepEqual(publicUndone.versions.find((v: any) => v.number === 2).marks, beforeUndo.versions![1].marks, '公開高亮跟著上一版')
  await assert.rejects(editMeeting(source.id, 'publish', 10, undone.draft), /沒有變更/)
  const again = structuredClone(undone.draft); again.chair = '撤回後重新編排'
  const republished = await editMeeting(source.id, 'publish', 10, again)
  assert.deepEqual(republished.record.versions?.map(v => v.number), [1, 2, 3], '撤回後從上一版加一')
  assert.equal(republished.record.versions?.[2].marks.chair, 3)
  await editMeeting(source.id, 'undo', 11, { number: 3 })
  const toFirst = await editMeeting(source.id, 'undo', 12, { number: 2 })
  assert.equal(toFirst.record.publishedVersion, 1, '可連續撤回')
  await assert.rejects(editMeeting(source.id, 'undo', 13, { number: 1 }), /沒有更早的版本/)
  await editMeeting(source.id, 'publish', 13, again)
  await editMeeting(source.id, 'unpublish', 14)
  const hiddenUndo = await editMeeting(source.id, 'undo', 15, { number: 2 })
  assert.equal(hiddenUndo.record.published, null, '下架週次撤回後維持下架')
  assert.equal(hiddenUndo.record.publishedVersion, 1)
  assert.equal((await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).status, 404)
  const showAgain = await editMeeting(source.id, 'publish', 16, hiddenUndo.record.draft)
  assert.equal(showAgain.record.publishedVersion, 1, '下架後同版重新發布不進版')
  // ADR-0053 舊流程留下的狀態：公開第1版但保留第2、3版，下次發布時直接接在公開版之後。
  const leftover = { ...beforeUndo, publishedVersion: 1, draftBaseVersion: 1, published: beforeUndo.versions![0].meeting, draft: beforeUndo.versions![0].meeting, revision: 30 }
  rows.set(recordKey, { key: recordKey, value: JSON.stringify(leftover) })
  const edited = structuredClone(leftover.draft); edited.chair = '舊流程後的修改'
  const afterLeftover = await editMeeting(source.id, 'publish', 30, edited)
  assert.deepEqual(afterLeftover.record.versions?.map(v => v.number), [1, 2], '不再要求確認刪除後續版本')
  assert.equal(afterLeftover.record.versions?.[1].marks.chair, 2, '高亮相對公開版')
  assert.deepEqual(afterLeftover.record.versionDates, { 1: '2026-10-01' })
  assert.equal(afterLeftover.record.draftBaseVersion, undefined, '不再寫入草稿基準版')
  console.log('週中節目：撤回最新版、連續撤回、下架撤回、競爭更新與舊流程資料相容通過')
  console.log('週中節目：草稿隔離、發布快照、競爭更新、來源更新、重建與下架檢查通過')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
