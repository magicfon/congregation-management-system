import { Prisma, PrismaClient } from '@prisma/client'
import { isAreaDispatched } from './allocation'
import { taipeiDate } from './google-sheets'

// 依 Sheet「傳道區域回報」歷史常用值整理；其他時段由使用者自填
export const REPORT_TIMESLOTS = ['星期六早上', '星期日早上', '星期三早上', '星期一早上', '星期三晚上']
export const REPORT_SHEET_RANGE = '傳道區域回報!A:G'
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000
export const MAX_REPORT_AREAS = 20

export class TerritoryReportError extends Error { constructor(message: string, public status = 400) { super(message) } }

export type TerritoryReportInput = { sheetNos: number[]; timeslot: string; startDate: string; endDate: string; note: string }
export type ReportArea = { id: string; sheetNo: number | null; assignedMemberId: string | null; dispatchedAt: Date | null; completedAt: Date | null; lastReportedCompletedAt: Date | null }

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

export function parseReportInput(body: unknown, now = new Date()): TerritoryReportInput {
  const value = (body || {}) as Record<string, unknown>
  const raw = Array.isArray(value.sheetNos) ? value.sheetNos : [value.sheetNo]
  const sheetNos = [...new Set(raw.map(Number))]
  if (!sheetNos.length || sheetNos.some(no => !Number.isInteger(no) || no < 1 || no > 213)) throw new TerritoryReportError('區域號碼須為 1–213')
  if (sheetNos.length > MAX_REPORT_AREAS) throw new TerritoryReportError(`一次最多回報 ${MAX_REPORT_AREAS} 區`)
  const timeslot = typeof value.timeslot === 'string' ? value.timeslot.trim() : ''
  if (!timeslot || timeslot.length > 30) throw new TerritoryReportError('請選擇或填寫傳道時段（最多 30 字）')
  if (!validDate(value.startDate) || !validDate(value.endDate)) throw new TerritoryReportError('請填寫有效的開始日與結束日')
  if (value.startDate > value.endDate) throw new TerritoryReportError('結束日不能早於開始日')
  if (value.endDate > taipeiDate(now)) throw new TerritoryReportError('結束日不能晚於今天')
  const note = typeof value.note === 'string' ? value.note.trim() : ''
  if (note.length > 500) throw new TerritoryReportError('備註最多 500 字')
  return { sheetNos, timeslot, startDate: value.startDate, endDate: value.endDate, note }
}

/** 回報後該區是否交回：使用中，且結束日不早於該輪領取日（台北日曆日）。 */
export function reportReturnsArea(area: ReportArea, endDate: string) {
  if (!isAreaDispatched(area)) return false
  return !area.dispatchedAt || endDate >= taipeiDate(area.dispatchedAt)
}

/** 使用中卻已有晚於領取日的完成回報：回報了卻沒交回。同一天不算，可能是前一位的回報。 */
export function reportedButHeld(area: ReportArea) {
  return isAreaDispatched(area) && Boolean(area.dispatchedAt && area.lastReportedCompletedAt) && taipeiDate(area.lastReportedCompletedAt) > taipeiDate(area.dispatchedAt)
}

/** USER_ENTERED 會執行公式，使用者文字開頭若像公式就當純文字。 */
function sheetText(text: string) { return /^[=+\-@]/.test(text) ? `'${text}` : text }
function sheetDate(date: string) { const [y, m, d] = date.split('-').map(Number); return `${y}/${m}/${d}` }
export function reportSheetRow(name: string, input: TerritoryReportInput, sheetNo: number, now: Date): (string | number)[] {
  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })
  return [`${sheetDate(taipeiDate(now))} ${time}`, sheetText(name), sheetText(input.timeslot), sheetNo, sheetDate(input.startDate), sheetDate(input.endDate), sheetText(input.note)]
}

export function reportContent(input: TerritoryReportInput, sheetNo: number) {
  const { sheetNos: _, ...fields } = input
  return JSON.stringify({ source: 'territory-report', sheetNo, ...fields })
}

/**
 * 建立回報：每區各寫一筆系統紀錄、需要時交回，最後一次 append 每區一列到 Sheet。
 * append 在 transaction 內最後一步，失敗則整筆回滾，避免 DB 與 Sheet 不一致。
 */
export async function submitTerritoryReport(db: PrismaClient, memberId: string, input: TerritoryReportInput, appendRows: (rows: (string | number)[][]) => Promise<void>, now = new Date()) {
  return db.$transaction(async tx => {
    const member = await tx.member.findUnique({ where: { id: memberId }, select: { name: true, active: true, deletedAt: true } })
    if (!member?.active || member.deletedAt) throw new TerritoryReportError('帳號未啟用', 403)
    const results: { sheetNo: number; returned: boolean }[] = []
    for (const sheetNo of input.sheetNos) {
      const area = await tx.area.findUnique({ where: { sheetNo } })
      if (!area) throw new TerritoryReportError(`找不到區域號碼 ${sheetNo}`)
      const ownHeld = isAreaDispatched(area) && area.assignedMemberId === memberId
      if (ownHeld && area.dispatchedAt && input.endDate < taipeiDate(area.dispatchedAt)) throw new TerritoryReportError(`${sheetNo} 號：結束日早於您領取這張地圖的日期（${taipeiDate(area.dispatchedAt)}）`)
      const content = reportContent(input, sheetNo)
      const duplicate = await tx.report.findFirst({ where: { memberId, areaId: area.id, content, submittedAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) } } })
      if (duplicate) throw new TerritoryReportError(`${sheetNo} 號的回報剛剛已送出，不需要重複送出`, 409)
      const returned = reportReturnsArea(area, input.endDate)
      const endAt = new Date(`${input.endDate}T00:00:00+08:00`)
      const reported = !area.lastReportedCompletedAt || area.lastReportedCompletedAt < endAt ? { lastReportedCompletedAt: endAt } : {}
      if (returned) {
        const updated = await tx.area.updateMany({ where: { id: area.id, assignedMemberId: area.assignedMemberId, dispatchedAt: area.dispatchedAt, completedAt: area.completedAt }, data: { completedAt: now, lastActivityAt: now, ...reported } })
        if (updated.count !== 1) throw new TerritoryReportError(`${sheetNo} 號地圖狀態剛被更新，請重新載入後再送出`, 409)
      } else if ('lastReportedCompletedAt' in reported) {
        await tx.area.update({ where: { id: area.id }, data: reported })
      }
      await tx.report.create({ data: { areaId: area.id, memberId, content, status: 'approved', reviewedAt: now, submittedAt: now } })
      results.push({ sheetNo, returned })
    }
    await appendRows(input.sheetNos.map(sheetNo => reportSheetRow(member.name, input, sheetNo, now)))
    return results
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000, maxWait: 10000 })
}
