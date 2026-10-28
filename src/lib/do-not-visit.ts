import { Prisma, PrismaClient } from '@prisma/client'
import { batchUpdate, sheetRow, DEFAULT_SHEET_ID } from './google-sheets'
import { normalizeDoNotVisit, mergeDoNotVisit } from './do-not-visit-list'
export { normalizeDoNotVisit, doNotVisitList, mergeDoNotVisit, MAX_DO_NOT_VISIT_ADDRESS } from './do-not-visit-list'

// 拒絕拜訪地址：Sheet「區域狀態」J 欄 ↔ areas.doNotVisit（ADR-0083）
export const DO_NOT_VISIT_COLUMN = 'J'
export const DO_NOT_VISIT_SNAPSHOT_KEY = 'sheet_j_snapshot'
export const MAX_DO_NOT_VISIT_TEXT = 3000

/** RAW 寫入，公式字元不會被執行；單格不超過 Sheet 上限。 */
export async function pushDoNotVisit(items: { sheetNo: number; text: string }[]) {
  if (!items.length) return
  await batchUpdate(DEFAULT_SHEET_ID, items.map(item => ({ range: `區域狀態!${DO_NOT_VISIT_COLUMN}${sheetRow(item.sheetNo)}`, values: [[item.text]] })))
}

type Db = PrismaClient | Prisma.TransactionClient

export async function readDoNotVisitSnapshot(db: Db): Promise<Map<number, string>> {
  const setting = await db.setting.findUnique({ where: { key: DO_NOT_VISIT_SNAPSHOT_KEY } })
  if (!setting) return new Map()
  return new Map(Object.entries(JSON.parse(setting.value) as Record<string, string>).map(([no, text]) => [Number(no), text]))
}

export async function updateDoNotVisitSnapshot(db: Db, updates: Map<number, string>) {
  if (!updates.size) return
  const snapshot = await readDoNotVisitSnapshot(db)
  for (const [no, text] of updates) snapshot.set(no, text)
  const value = JSON.stringify(Object.fromEntries(Array.from(snapshot).sort((a, b) => a[0] - b[0])))
  await db.setting.upsert({ where: { key: DO_NOT_VISIT_SNAPSHOT_KEY }, create: { key: DO_NOT_VISIT_SNAPSHOT_KEY, value }, update: { value } })
}

/** 網站修改後立刻寫回 Sheet；失敗時系統已存，下次同步會因「系統≠快照」補寫。 */
export async function writeBackDoNotVisit(db: PrismaClient, sheetNo: number | null, text: string): Promise<string> {
  if (sheetNo === null) return ''
  try {
    await pushDoNotVisit([{ sheetNo, text }])
    await updateDoNotVisitSnapshot(db, new Map([[sheetNo, text]]))
    return ''
  } catch (error) {
    console.error('do-not-visit write-back failed:', error)
    return '已儲存，Sheet 稍後會自動同步。'
  }
}

/**
 * 同步 J 欄。rows 為「區域狀態!B2:J214」：row[0] 是區號、row[8] 是 J 欄。
 * Sheet 變→匯入；系統變→補寫；兩邊都變→合併寫回兩邊。快照每次涵蓋讀到的全部區域。
 */
export async function syncDoNotVisit(db: PrismaClient, rows: string[][]) {
  const result = { imported: 0, pushed: 0, conflicts: 0 }
  const snapshot = await readDoNotVisitSnapshot(db)
  const areas = await db.area.findMany({ where: { sheetNo: { not: null } }, select: { id: true, sheetNo: true, doNotVisit: true } })
  const bySheetNo = new Map(areas.map(area => [area.sheetNo!, area]))
  const nextSnapshot = new Map<number, string>()
  const push: { sheetNo: number; text: string }[] = []
  const dbUpdates: { id: string; text: string }[] = []
  for (const row of rows) {
    const sheetNo = Number(row[0])
    const area = bySheetNo.get(sheetNo)
    if (!Number.isInteger(sheetNo) || !area || nextSnapshot.has(sheetNo)) continue
    const sheet = normalizeDoNotVisit(row[8])
    const local = normalizeDoNotVisit(area.doNotVisit)
    const snap = snapshot.get(sheetNo)
    let value = sheet
    if (snap === undefined) {
      // 第一次同步：以 Sheet 為準，系統若已有不同內容則合併，不丟資料
      if (local && local !== sheet) { value = mergeDoNotVisit(sheet, local); result.conflicts++ }
    } else {
      const sheetChanged = sheet !== snap, localChanged = local !== snap
      if (sheetChanged && localChanged && sheet !== local) { value = mergeDoNotVisit(sheet, local); result.conflicts++ }
      else if (localChanged && !sheetChanged) value = local
    }
    if (value !== sheet) { push.push({ sheetNo, text: value }); result.pushed++ }
    if (value !== local) { dbUpdates.push({ id: area.id, text: value }); if (value === sheet) result.imported++ }
    nextSnapshot.set(sheetNo, value)
  }
  if (push.length) await pushDoNotVisit(push)
  if (dbUpdates.length) await db.$transaction(dbUpdates.map(update => db.area.update({ where: { id: update.id }, data: { doNotVisit: update.text } })))
  await updateDoNotVisitSnapshot(db, nextSnapshot)
  return result
}
