import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { parseWeek } from '../src/lib/midweek-import'
import { MeetingConflict, MeetingError, newMeeting } from '../src/lib/midweek'
import { editMeeting, getRecord, meetingList, SOURCE_PREFIX } from '../src/lib/midweek-store'
import { draftBaseVersionOf, publishedVersionOf } from '../src/lib/midweek-versions'
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
  // Simulate a record written before explicit published/draft version pointers existed.
  const legacy = (await getRecord(source.id))!
  delete legacy.publishedVersion; delete legacy.draftBaseVersion
  legacy.versionDates = { 1: '2026-10-01', 2: '2026-10-02', 3: '2026-10-03' }
  const recordKey = `midweek:record:${source.id}`
  rows.set(recordKey, { key: recordKey, value: JSON.stringify(legacy) })
  const beforeRestore = (await getRecord(source.id))!
  assert.equal(publishedVersionOf(beforeRestore)?.number, 3, '舊資料預設最後發布版')
  assert.equal(draftBaseVersionOf(beforeRestore)?.number, 3)
  for (const number of [0, -1, 1.5, 999, '1', undefined]) {
    await assert.rejects(editMeeting(source.id, 'restore', 8, { number }), MeetingError)
  }
  assert.deepEqual(await getRecord(source.id), beforeRestore, '無效版號不可修改資料')
  await assert.rejects(editMeeting(source.id, 'restore', 7, { number: 1 }), MeetingConflict)
  const restored = await editMeeting(source.id, 'restore', 8, { number: 1 })
  assert.equal(restored.record.draftBaseVersion, 1)
  assert.deepEqual(restored.record.draft, beforeRestore.versions![0].meeting, '完整還原指定快照到草稿')
  assert.deepEqual(restored.record.published, beforeRestore.published, '退回草稿不更改公開內容')
  assert.equal(restored.record.publishedAt, beforeRestore.publishedAt)
  assert.deepEqual(restored.record.versions, beforeRestore.versions, '退回不更改歷史與日期')
  const publicBeforePublish = await (await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).json()
  assert.equal(publicBeforePublish.meeting.chair, '新版主席')
  assert.equal(publicBeforePublish.publishedVersion, 3)
  const republished = await editMeeting(source.id, 'publish', 9, restored.record.draft)
  assert.equal(republished.record.publishedVersion, 1, '退回第1版再發布仍為第1版')
  assert.equal(republished.record.draftBaseVersion, 1)
  assert.deepEqual(republished.record.versions, beforeRestore.versions, '退回發布保留全部後續版本、日期與高亮')
  const visibleFirst = await (await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).json()
  assert.equal(visibleFirst.publishedVersion, 1)
  assert.deepEqual(visibleFirst.meeting, beforeRestore.versions![0].meeting)
  assert.deepEqual(visibleFirst.versions.find((v: any) => v.number === visibleFirst.publishedVersion).marks, beforeRestore.versions![0].marks, '公開高亮跟隨目前發布版')
  await assert.rejects(editMeeting(source.id, 'publish', 10, republished.record.draft), /沒有變更/)
  const edited = structuredClone(republished.record.draft); edited.chair = '退回後重新編排'
  await editMeeting(source.id, 'save', 10, edited)
  const saved = (await getRecord(source.id))!
  assert.equal(draftBaseVersionOf(saved)?.number, 1, '儲存與重新讀取仍保留草稿基準')
  assert.equal(saved.published?.chair, beforeRestore.versions![0].meeting.chair)
  for (const flag of [undefined, false, 'true']) {
    await assert.rejects(editMeeting(source.id, 'publish', 11, edited, { deleteLaterVersions: flag }), /確認刪除/)
    assert.deepEqual(await getRecord(source.id), saved, '未確認刪除不得改草稿、歷史或公開內容')
  }
  await assert.rejects(editMeeting(source.id, 'publish', 10, edited, { deleteLaterVersions: true }), MeetingConflict)
  const concurrentPublishes = await Promise.allSettled([
    editMeeting(source.id, 'publish', 11, edited, { deleteLaterVersions: true }),
    editMeeting(source.id, 'publish', 11, edited, { deleteLaterVersions: true }),
  ])
  assert.equal(concurrentPublishes.filter(r => r.status === 'fulfilled').length, 1, '刪除後續版本與發布原子完成，並行只一筆成功')
  assert.ok(concurrentPublishes.some(r => r.status === 'rejected' && r.reason instanceof MeetingConflict))
  const replacement = (await getRecord(source.id))!
  assert.deepEqual(replacement.versions?.map(v => v.number), [1, 2], '從當前第1版加一，不使用歷史最高版號')
  assert.equal(replacement.publishedVersion, 2)
  assert.equal(replacement.versions?.[1].meeting.chair, edited.chair)
  assert.equal(replacement.versions?.[1].marks.chair, 2, '重新進版高亮依第1版比較')
  assert.deepEqual(replacement.versions?.[0], beforeRestore.versions![0])
  assert.deepEqual(replacement.versionDates, { 1: '2026-10-01' }, '刪除後續版次的補填日期')
  const publicReplacement = await (await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).json()
  assert.equal(publicReplacement.publishedVersion, 2)
  assert.equal(publicReplacement.versions.length, 2)
  assert.equal(publicReplacement.meeting.chair, edited.chair)
  await editMeeting(source.id, 'unpublish', 12)
  const hiddenRestore = await editMeeting(source.id, 'restore', 13, { number: 1 })
  assert.equal(hiddenRestore.record.published, null, '退回下架週次仍保持下架')
  assert.equal(hiddenRestore.record.versions?.length, 2)
  assert.equal((await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).status, 404)
  const hiddenRepublish = await editMeeting(source.id, 'publish', 14, hiddenRestore.record.draft)
  assert.equal(hiddenRepublish.record.publishedVersion, 1)
  assert.equal(hiddenRepublish.record.versions?.length, 2)
  await editMeeting(source.id, 'unpublish', 15)
  const unchangedRepublish = await editMeeting(source.id, 'publish', 16, hiddenRepublish.record.draft)
  assert.equal(unchangedRepublish.record.publishedVersion, 1, '下架後同版重新發布不進版')
  assert.equal(unchangedRepublish.record.versions?.length, 2)
  await assert.rejects(editMeeting(source.id, 'publish', 17, hiddenRepublish.record.draft), /沒有變更/)
  const returnToSecond = await editMeeting(source.id, 'restore', 17, { number: 2 })
  const restoredSecond = await editMeeting(source.id, 'publish', 18, returnToSecond.record.draft)
  assert.equal(restoredSecond.record.publishedVersion, 2, '可切回保留的後續版次，不重複建立版本')
  assert.equal(restoredSecond.record.versions?.length, 2)
  const concurrentRestores = await Promise.allSettled([
    editMeeting(source.id, 'restore', 19, { number: 1 }),
    editMeeting(source.id, 'restore', 19, { number: 2 }),
  ])
  assert.equal(concurrentRestores.filter(r => r.status === 'fulfilled').length, 1)
  assert.ok(concurrentRestores.some(r => r.status === 'rejected' && r.reason instanceof MeetingConflict))
  // Standalone deletion must preserve the current publication and both saved/unsaved editing flows.
  rows.set(recordKey, { key: recordKey, value: JSON.stringify(beforeRestore) })
  const pendingRestore = await editMeeting(source.id, 'restore', 8, { number: 1 })
  await assert.rejects(editMeeting(source.id, 'delete-later', 9, undefined, { deleteLaterVersions: true }), /請先發布第1版/)
  assert.deepEqual(await getRecord(source.id), pendingRestore.record, '不能刪除仍公開的後續版')
  await editMeeting(source.id, 'publish', 9, pendingRestore.record.draft)
  const retainedDraft = structuredClone(pendingRestore.record.draft); retainedDraft.chair = '尚未發布的草稿'
  await editMeeting(source.id, 'save', 10, retainedDraft)
  const beforeDelete = (await getRecord(source.id))!
  for (const flag of [undefined, false, 'true']) {
    await assert.rejects(editMeeting(source.id, 'delete-later', 11, undefined, { deleteLaterVersions: flag }), /確認刪除/)
    assert.deepEqual(await getRecord(source.id), beforeDelete)
  }
  await assert.rejects(editMeeting(source.id, 'delete-later', 10, undefined, { deleteLaterVersions: true }), MeetingConflict)
  const deletes = await Promise.allSettled([
    editMeeting(source.id, 'delete-later', 11, { chair: '不可覆蓋草稿' }, { deleteLaterVersions: true }),
    editMeeting(source.id, 'delete-later', 11, undefined, { deleteLaterVersions: true }),
  ])
  assert.equal(deletes.filter(r => r.status === 'fulfilled').length, 1, '並行獨立刪除只成功一次')
  assert.ok(deletes.some(r => r.status === 'rejected' && r.reason instanceof MeetingConflict))
  const afterDelete = (await getRecord(source.id))!
  assert.deepEqual(afterDelete.versions, beforeDelete.versions!.slice(0, 1))
  assert.deepEqual(afterDelete.versionDates, { 1: '2026-10-01' })
  assert.deepEqual(afterDelete.draft, retainedDraft, '獨立刪除不覆蓋已保存草稿')
  assert.deepEqual(afterDelete.published, beforeDelete.published, '獨立刪除不發布草稿')
  assert.equal(afterDelete.publishedAt, beforeDelete.publishedAt)
  assert.equal(afterDelete.publishedVersion, 1, '獨立刪除不進版')
  await assert.rejects(editMeeting(source.id, 'delete-later', 12, undefined, { deleteLaterVersions: true }), /沒有後續版本/)
  const afterDeletePublish = await editMeeting(source.id, 'publish', 12, retainedDraft)
  assert.deepEqual(afterDeletePublish.record.versions?.map(v => v.number), [1, 2], '刪除後可從當前版正常進版')
  rows.set(recordKey, { key: recordKey, value: JSON.stringify(beforeRestore) })
  await editMeeting(source.id, 'restore', 8, { number: 1 })
  await editMeeting(source.id, 'unpublish', 9)
  const hiddenDelete = await editMeeting(source.id, 'delete-later', 10, undefined, { deleteLaterVersions: true })
  assert.equal(hiddenDelete.record.published, null)
  assert.equal(hiddenDelete.record.publishedVersion, 1, '下架後刪除不留失效版號')
  assert.equal(hiddenDelete.record.versions?.length, 1)
  assert.equal((await publicMeeting(new Request(`http://localhost/api/midweek?id=${source.id}`))).status, 404)
  const showAgain = await editMeeting(source.id, 'publish', 11, hiddenDelete.record.draft)
  assert.equal(showAgain.record.publishedVersion, 1)
  console.log('週中節目：獨立刪除確認、公開版保護、草稿保留、日期清理、競爭更新與再次進版通過')
  console.log('週中節目：退回原版號、保留後續版、確認刪除再進版、公開高亮、舊資料相容與並行保護通過')
  console.log('週中節目：草稿隔離、發布快照、競爭更新、來源更新、重建與下架檢查通過')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
