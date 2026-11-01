import { Prisma, PrismaClient } from '@prisma/client'
import { isAreaDispatched } from './allocation'
import { taipeiDate } from './google-sheets'
import { MAX_DO_NOT_VISIT_ADDRESS } from './do-not-visit-list'

// 依 Sheet「傳道區域回報」歷史常用值整理；其他時段由使用者自填
export const REPORT_TIMESLOTS = ['星期六早上', '星期日早上', '星期三早上', '星期一早上', '星期三晚上']
export const REPORT_SHEET_RANGE = '傳道區域回報!A:G'
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000
export const MAX_REPORT_AREAS = 20

export class TerritoryReportError extends Error { constructor(message: string, public status = 400) { super(message) } }

export type TerritoryReportInput = { name: string; sheetNos: number[]; timeslot: string; startDate: string; endDate: string; note: string; doNotVisit: string }
export type ReportArea = { id: string; sheetNo: number | null; assignedMemberId: string | null; dispatchedAt: Date | null; completedAt: Date | null; lastReportedCompletedAt: Date | null }

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

/** 未登入（過渡期）須自填姓名；登入者的姓名由帳號帶入，body 內的 name 不採用。 */
export function parseReportInput(body: unknown, now = new Date(), guest = false): TerritoryReportInput {
  const value = (body || {}) as Record<string, unknown>
  const name = guest && typeof value.name === 'string' ? value.name.trim().replace(/\s+/g, ' ') : ''
  if (guest && (!name || name.length > 30)) throw new TerritoryReportError('請填寫姓名（最多 30 字）')
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
  // 拒絕拜訪地址只在回報一區時收（ADR-0086），單行、送管理員審核
  const doNotVisit = typeof value.doNotVisit === 'string' ? value.doNotVisit.replace(/\s+/g, ' ').trim() : ''
  if (doNotVisit && sheetNos.length !== 1) throw new TerritoryReportError('拒絕拜訪地址只能在回報一區時填寫')
  if (doNotVisit.length > MAX_DO_NOT_VISIT_ADDRESS) throw new TerritoryReportError(`拒絕拜訪地址最多 ${MAX_DO_NOT_VISIT_ADDRESS} 字`)
  return { name, sheetNos, timeslot, startDate: value.startDate, endDate: value.endDate, note, doNotVisit }
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
  const { sheetNos: _, name: __, doNotVisit: ___, ...fields } = input
  return JSON.stringify({ source: 'territory-report', sheetNo, ...fields })
}

/** 回報者：登入帳號，或未登入時以自填姓名對到的成員（永遠不算管理員）。 */
export type ReportActor = { memberId: string | null; name: string; admin: boolean; selfManaged?: boolean }
/**
 * 每區的處理（ADR-0100）：
 * return 自己的地圖交回；proxy 管理員代持有人回報並交回；confirm 別人的地圖，交管理員確認；
 * merge 管理員回報已有待確認的地圖，併入同一則；record 只留紀錄；blocked 不能送出；
 * self 自主管理地圖的成員（ADR-0101）回報未領取的地圖：只留紀錄，免確認；別人領取中的照一般規則。
 */
export type ReportAction = 'return' | 'proxy' | 'confirm' | 'merge' | 'record' | 'blocked' | 'self'
export type ReportVerdict = { action: ReportAction; reason: string }

export function classifyReportArea(area: ReportArea, actor: ReportActor, endDate: string, pendingAlert: boolean): ReportVerdict {
  const held = isAreaDispatched(area)
  if (held && actor.memberId && area.assignedMemberId === actor.memberId) {
    const dispatched = taipeiDate(area.dispatchedAt)
    if (area.dispatchedAt && endDate < dispatched) return { action: 'blocked', reason: `結束日早於您領取這張地圖的日期（${dispatched}）` }
    return { action: 'return', reason: '會交回（你領取的）' }
  }
  if (pendingAlert) return actor.admin
    ? { action: 'merge', reason: '已有人回報，待管理員確認；這筆會併入同一則待確認，不交回' }
    : { action: 'blocked', reason: '這張地圖已有人回報，待管理員確認' }
  if (!held && actor.selfManaged) return { action: 'self', reason: '自主管理：只寫入回報紀錄與完成日' }
  if (!held) return actor.admin
    ? { action: 'record', reason: '目前未領取，只寫入回報紀錄與完成日，不改變分配' }
    : { action: 'blocked', reason: '這張地圖目前未領取，請洽管理員' }
  if (!actor.admin) return { action: 'confirm', reason: '這張地圖目前由其他人領取，將交管理員確認' }
  return reportReturnsArea(area, endDate)
    ? { action: 'proxy', reason: '不是你領取的，將以持有人名義代為回報並交回' }
    : { action: 'record', reason: '結束日早於目前持有人的領取日，只寫入回報紀錄，不交回' }
}
export const needsConfirmation = (verdict: ReportVerdict) => !['return', 'blocked', 'self'].includes(verdict.action)

/** 同一輪派發的鍵：領取時間；沒有領取時間的舊資料用 none。 */
export const dispatchKey = (area: { dispatchedAt: Date | null }) => area.dispatchedAt ? area.dispatchedAt.toISOString() : 'none'

type Tx = Prisma.TransactionClient
export type AlertReport = { name: string; startDate: string; endDate: string; at: string }
type AlertArea = ReportArea & { assignedMember?: { name: string } | null }

/** 回報他人地圖：同一輪同一則，已結案的再有人回報就重新開啟。 */
export async function addNotHolderReport(tx: Tx, area: AlertArea, entry: AlertReport, reportId: string | null, now: Date) {
  const key = { areaId_kind_cycleKey: { areaId: area.id, kind: 'not_holder', cycleKey: dispatchKey(area) } }
  const existing = await tx.reportAlert.findUnique({ where: key })
  const previous = ((existing?.details as { reports?: AlertReport[] } | null)?.reports) || []
  // cron 會再讀到站內寫入的 Sheet 列：同一人同一結束日只記一次
  if (previous.some(r => r.name === entry.name && r.endDate === entry.endDate)) return
  const reports = [...previous, entry]
  const details = { holder: area.assignedMember?.name || '未記錄', dispatched: taipeiDate(area.dispatchedAt), reports }
  if (existing) await tx.reportAlert.update({ where: { id: existing.id }, data: { status: 'pending', details, resolvedAt: null, resolvedBy: null, resolution: null, updatedAt: now } })
  else await tx.reportAlert.create({ data: { areaId: area.id, kind: 'not_holder', cycleKey: dispatchKey(area), reportId, details, createdAt: now, updatedAt: now } })
}

/** 回報交回前的狀態，交回依據從 Sheet 消失時供恢復使用中。 */
export function returnUndoState(area: AlertArea, endDate: string, returnedAt: Date) {
  return { memberId: area.assignedMemberId, holder: area.assignedMember?.name || '', dispatchedAt: area.dispatchedAt?.toISOString() ?? null, completedAt: area.completedAt?.toISOString() ?? null, endDate, returnedAt: returnedAt.toISOString() }
}

/** 登入者用帳號；未登入者以姓名對應啟用中的成員，對不到仍可回報，只是不留系統紀錄。 */
export async function resolveReportActor(db: Tx | PrismaClient, accountId: string | null, admin: boolean, name: string): Promise<ReportActor> {
  const member = accountId
    ? await db.member.findUnique({ where: { id: accountId }, select: { id: true, name: true, active: true, deletedAt: true, selfManagedReports: true } })
    : await db.member.findFirst({ where: { name, active: true, deletedAt: null }, select: { id: true, name: true, active: true, deletedAt: true, selfManagedReports: true } })
  if (accountId && (!member?.active || member.deletedAt)) throw new TerritoryReportError('帳號未啟用', 403)
  return { memberId: member?.id ?? null, name: accountId ? member!.name : name, admin: Boolean(accountId) && admin, selfManaged: Boolean(member?.selfManagedReports) }
}

export const BROTHERS_ONLY_MESSAGE = '區域回報是弟兄傳道使用；姊妹若有領取個人區域，領取後即可在這裡回報。'
/** 已登入的姊妹沒有領取中的個人區域就不能回報（ADR-0106）；管理員不受限，未登入無法判斷性別。 */
export async function brothersOnlyBlocked(db: Tx | PrismaClient, accountId: string | null, admin: boolean) {
  if (!accountId || admin) return false
  const member = await db.member.findUnique({ where: { id: accountId }, select: { gender: true } })
  if (member?.gender !== 'sister') return false
  const personal = await db.area.findMany({ where: { assignedMemberId: accountId, personalTerritory: true }, select: { assignedMemberId: true, dispatchedAt: true, completedAt: true } })
  return !personal.some(isAreaDispatched)
}

/** 送出前的確認畫面用：逐區判斷，不寫入。 */
export async function checkTerritoryReport(db: PrismaClient, actor: ReportActor, sheetNos: number[], endDate: string) {
  const areas = await db.area.findMany({ where: { sheetNo: { in: sheetNos } } })
  const pending = new Set((await db.reportAlert.findMany({ where: { areaId: { in: areas.map(a => a.id) }, kind: 'not_holder', status: 'pending' }, select: { areaId: true } })).map(a => a.areaId))
  return sheetNos.map(sheetNo => {
    const area = areas.find(a => a.sheetNo === sheetNo)
    return { sheetNo, ...(area ? classifyReportArea(area, actor, endDate, pending.has(area.id)) : { action: 'blocked' as const, reason: `找不到區域號碼 ${sheetNo}` }) }
  })
}

/**
 * 建立回報：每區依 classifyReportArea 處理，最後一次 append 每區一列到 Sheet。
 * append 在 transaction 內最後一步，失敗則整筆回滾，避免 DB 與 Sheet 不一致。
 * 有需要警示的區域時，必須帶 confirmed（確認畫面已勾選）。
 */
export async function submitTerritoryReport(db: PrismaClient, accountId: string | null, input: TerritoryReportInput, appendRows: (rows: (string | number)[][]) => Promise<void>, now = new Date(), options: { admin?: boolean; confirmed?: boolean } = {}) {
  return db.$transaction(async tx => {
    const actor = await resolveReportActor(tx, accountId, Boolean(options.admin), input.name)
    if (await brothersOnlyBlocked(tx, accountId, Boolean(options.admin))) throw new TerritoryReportError(BROTHERS_ONLY_MESSAGE, 403)
    const results: { sheetNo: number; action: ReportAction }[] = []
    const rows: (string | number)[][] = []
    for (const sheetNo of input.sheetNos) {
      const area = await tx.area.findUnique({ where: { sheetNo }, include: { assignedMember: { select: { name: true } } } })
      if (!area) throw new TerritoryReportError(`找不到區域號碼 ${sheetNo}`)
      const pending = await tx.reportAlert.findFirst({ where: { areaId: area.id, kind: 'not_holder', status: 'pending' } })
      const verdict = classifyReportArea(area, actor, input.endDate, Boolean(pending))
      if (verdict.action === 'blocked') throw new TerritoryReportError(`${sheetNo} 號：${verdict.reason}`, 409)
      if (needsConfirmation(verdict) && !options.confirmed) throw new TerritoryReportError(`${sheetNo} 號需要確認，請在確認畫面勾選後再送出`, 409)
      // 管理員代為回報：Sheet 姓名與系統紀錄都記在持有人名下
      const proxy = verdict.action === 'proxy'
      const reportMemberId = proxy ? area.assignedMemberId : actor.memberId
      const content = proxy ? JSON.stringify({ ...JSON.parse(reportContent(input, sheetNo)), reportedBy: actor.name }) : reportContent(input, sheetNo)
      const duplicate = reportMemberId && await tx.report.findFirst({ where: { memberId: reportMemberId, areaId: area.id, content, submittedAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) } } })
      if (duplicate) throw new TerritoryReportError(`${sheetNo} 號的回報剛剛已送出，不需要重複送出`, 409)
      const endAt = new Date(`${input.endDate}T00:00:00+08:00`)
      const reported = !area.lastReportedCompletedAt || area.lastReportedCompletedAt < endAt ? { lastReportedCompletedAt: endAt } : {}
      if (verdict.action === 'return' || proxy) {
        const updated = await tx.area.updateMany({ where: { id: area.id, assignedMemberId: area.assignedMemberId, dispatchedAt: area.dispatchedAt, completedAt: area.completedAt }, data: { completedAt: now, lastActivityAt: now, returnUndo: returnUndoState(area, input.endDate, now), ...reported } })
        if (updated.count !== 1) throw new TerritoryReportError(`${sheetNo} 號地圖狀態剛被更新，請重新載入後再送出`, 409)
        // 持有人自己交回：別人先前的回報留給管理員知道，不必再處理地圖；管理員代為回報則直接結案
        if (pending && proxy) await tx.reportAlert.update({ where: { id: pending.id }, data: { status: 'resolved', resolvedAt: now, resolvedBy: actor.name, resolution: 'admin_reported', updatedAt: now } })
        else if (pending) await tx.reportAlert.update({ where: { id: pending.id }, data: { kind: 'not_holder_returned', details: { ...(pending.details as object), holderReturned: { name: actor.name, endDate: input.endDate, at: now.toISOString() } }, updatedAt: now } })
      } else if ('lastReportedCompletedAt' in reported) {
        await tx.area.update({ where: { id: area.id }, data: reported })
      }
      const report = reportMemberId ? await tx.report.create({ data: { areaId: area.id, memberId: reportMemberId, content, status: 'approved', reviewedAt: now, submittedAt: now } }) : null
      if (verdict.action === 'confirm' || verdict.action === 'merge') await addNotHolderReport(tx, area, { name: actor.name, startDate: input.startDate, endDate: input.endDate, at: now.toISOString() }, report?.id ?? null, now)
      if (input.doNotVisit) await tx.doNotVisitReport.create({ data: { areaId: area.id, address: input.doNotVisit, reporterName: actor.name, memberId: actor.memberId, createdAt: now } })
      rows.push(reportSheetRow(proxy ? area.assignedMember?.name || actor.name : actor.name, input, sheetNo, now))
      results.push({ sheetNo, action: verdict.action })
    }
    await appendRows(rows)
    return results
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000, maxWait: 10000 })
}
