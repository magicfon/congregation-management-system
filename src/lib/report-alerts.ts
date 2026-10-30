import { Prisma, PrismaClient } from '@prisma/client'
import { isAreaDispatched } from './allocation'
import { taipeiDate } from './google-sheets'
import { AlertReport, dispatchKey, reportedButHeld, returnUndoState, TerritoryReportError } from './territory-report'

// 回報待確認（ADR-0100）
export const ALERT_KINDS = {
  not_holder: { badge: '回報他人地圖', actions: [{ action: 'return', label: '交回' }, { action: 'keep', label: '知道了' }] },
  held_after_report: { badge: '回報了卻未交回', actions: [{ action: 'return', label: '交回' }, { action: 'keep', label: '維持使用中' }] },
  return_basis_removed: { badge: '交回依據已刪除', actions: [{ action: 'restore', label: '恢復使用中' }, { action: 'keep', label: '維持交回' }] },
  sheet_holder_mismatch: { badge: 'Sheet 持有人不同', actions: [{ action: 'keep', label: '以系統為準' }, { action: 'use_sheet', label: '以 Sheet 為準' }] },
} as const
export type AlertKind = keyof typeof ALERT_KINDS
export type AlertAction = 'return' | 'keep' | 'restore' | 'use_sheet'

export type ReturnUndo = ReturnType<typeof returnUndoState>
export type SheetMismatch = { sheetNo: number; sheetMember: string; sheetDate: string; dbMember: string; dbDate: string }
type DetectArea = { id: string; sheetNo: number | null; assignedMemberId: string | null; dispatchedAt: Date | null; completedAt: Date | null; lastReportedCompletedAt: Date | null; returnUndo: Prisma.JsonValue | null }

/** 系統眼中的持有人：已交回的地圖保留歷史持有人，但對 Sheet C 欄而言是空白。 */
export function currentHolder(area: { assignedMemberId: string | null; dispatchedAt: Date | null; completedAt: Date | null; assignedMember?: { name: string } | null }) {
  return isAreaDispatched(area) ? area.assignedMember?.name || '' : ''
}

const heldKey = (area: DetectArea) => `${dispatchKey(area)}|${taipeiDate(area.lastReportedCompletedAt)}`

/** 交回依據仍有效：這次交回之後沒再派發或收回，且最後完成回報日退回到觸發回報的結束日之前。 */
export function basisRemoved(area: DetectArea): ReturnUndo | null {
  const undo = area.returnUndo as ReturnUndo | null
  if (!undo?.returnedAt || isAreaDispatched(area) || area.completedAt?.toISOString() !== undo.returnedAt) return null
  return !area.lastReportedCompletedAt || taipeiDate(area.lastReportedCompletedAt) < undo.endDate ? undo : null
}

/**
 * 每 15 分鐘同步時偵測：回報了卻未交回、交回依據已從 Sheet 刪除、Sheet C 欄衝突。
 * 同一區、同一種、同一輪只建一則；狀態已變的待確認自動結案。
 */
export async function syncReportAlerts(db: PrismaClient, mismatches: SheetMismatch[], now = new Date()) {
  const areas: DetectArea[] = await db.area.findMany({
    where: { OR: [{ assignedMemberId: { not: null }, lastReportedCompletedAt: { not: null } }, { returnUndo: { not: Prisma.DbNull } }, { reportAlerts: { some: { status: 'pending' } } }, { sheetNo: { in: mismatches.map(m => m.sheetNo) } }] },
    select: { id: true, sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true, lastReportedCompletedAt: true, returnUndo: true },
  })
  const alerts = await db.reportAlert.findMany({ where: { OR: [{ status: 'pending' }, { kind: 'not_holder' }] }, select: { id: true, areaId: true, kind: true, cycleKey: true, status: true } })
  const byId = new Map(areas.map(a => [a.id, a]))
  const notHolder = new Set(alerts.filter(a => a.kind === 'not_holder').map(a => `${a.areaId}|${a.cycleKey}`))
  const create: Prisma.ReportAlertCreateManyInput[] = []
  for (const area of areas) {
    // 回報他人地圖已建過的這一輪，不再重複提醒「回報了卻未交回」
    if (reportedButHeld(area) && !notHolder.has(`${area.id}|${dispatchKey(area)}`)) create.push({ areaId: area.id, kind: 'held_after_report', cycleKey: heldKey(area), details: { reported: taipeiDate(area.lastReportedCompletedAt), dispatched: taipeiDate(area.dispatchedAt) }, createdAt: now, updatedAt: now })
    const undo = basisRemoved(area)
    if (undo) create.push({ areaId: area.id, kind: 'return_basis_removed', cycleKey: undo.returnedAt, details: { ...undo, reported: taipeiDate(area.lastReportedCompletedAt) }, createdAt: now, updatedAt: now })
  }
  for (const m of mismatches) {
    const area = areas.find(a => a.sheetNo === m.sheetNo)
    if (area) create.push({ areaId: area.id, kind: 'sheet_holder_mismatch', cycleKey: `${m.sheetMember}|${m.sheetDate}|${m.dbMember}|${m.dbDate}`, details: m, createdAt: now, updatedAt: now })
  }
  const created = create.length ? (await db.reportAlert.createMany({ data: create, skipDuplicates: true })).count : 0
  const stale = alerts.filter(alert => {
    if (alert.status !== 'pending') return false
    const area = byId.get(alert.areaId)
    if (!area) return true
    if (alert.kind === 'not_holder') return !isAreaDispatched(area) || dispatchKey(area) !== alert.cycleKey
    if (alert.kind === 'held_after_report') return !reportedButHeld(area) || heldKey(area) !== alert.cycleKey
    if (alert.kind === 'return_basis_removed') return basisRemoved(area)?.returnedAt !== alert.cycleKey
    return false
  }).map(alert => alert.id)
  if (stale.length) await db.reportAlert.updateMany({ where: { id: { in: stale }, status: 'pending' }, data: { status: 'resolved', resolvedAt: now, resolvedBy: '系統', resolution: 'auto', updatedAt: now } })
  return { created, autoResolved: stale.length }
}

export type SheetWrite = { sheetNo: number; member: string; dispatchedAt: Date | null; keepDate: boolean }

/**
 * 管理員處理一則待確認。地圖狀態已變時自動結案並告知；Sheet 要寫的 C/D 由呼叫端在交易後寫入，
 * 失敗時 DB 照舊生效，交給 cron 補推（同 ADR-0094）。
 */
export async function resolveReportAlert(db: PrismaClient, id: string, action: AlertAction, admin: string, now = new Date()) {
  return db.$transaction(async tx => {
    const alert = await tx.reportAlert.findUnique({ where: { id }, include: { area: { include: { assignedMember: { select: { name: true } } } } } })
    if (!alert) throw new TerritoryReportError('找不到這則提醒', 404)
    if (alert.status !== 'pending') throw new TerritoryReportError('這則提醒已處理過', 409)
    const kind = alert.kind as AlertKind
    if (!ALERT_KINDS[kind]?.actions.some(a => a.action === action)) throw new TerritoryReportError('操作無效')
    const area = alert.area
    const close = (resolution: string) => tx.reportAlert.update({ where: { id }, data: { status: 'resolved', resolvedAt: now, resolvedBy: admin, resolution, updatedAt: now } })
    const stale = async () => { await tx.reportAlert.update({ where: { id }, data: { status: 'resolved', resolvedAt: now, resolvedBy: '系統', resolution: 'auto', updatedAt: now } }); return { stale: true as const, sheet: null } }
    if (action === 'keep') { await close('keep'); return { stale: false as const, sheet: null } }

    if (action === 'return') {
      if (!isAreaDispatched(area) || dispatchKey(area) !== alert.cycleKey.split('|')[0]) return stale()
      const reports = ((alert.details as { reports?: AlertReport[] }).reports) || []
      const endDate = kind === 'not_holder' ? reports.map(r => r.endDate).sort().pop() || taipeiDate(now) : taipeiDate(area.lastReportedCompletedAt)
      const updated = await tx.area.updateMany({ where: { id: area.id, assignedMemberId: area.assignedMemberId, dispatchedAt: area.dispatchedAt, completedAt: area.completedAt }, data: { completedAt: now, lastActivityAt: now, returnUndo: returnUndoState(area, endDate, now) } })
      if (updated.count !== 1) throw new TerritoryReportError('地圖狀態剛被更新，請重新整理後再試', 409)
      await close('return')
      return { stale: false as const, sheet: area.sheetNo ? { sheetNo: area.sheetNo, member: '', dispatchedAt: null, keepDate: true } : null }
    }

    if (action === 'restore') {
      const undo = basisRemoved(area)
      if (!undo || undo.returnedAt !== alert.cycleKey) return stale()
      const member = undo.memberId ? await tx.member.findFirst({ where: { id: undo.memberId, deletedAt: null }, select: { id: true, name: true } }) : null
      if (!member) throw new TerritoryReportError('原持有人已不在成員名單，請到地圖分配重新派發', 409)
      const dispatchedAt = undo.dispatchedAt ? new Date(undo.dispatchedAt) : null
      const updated = await tx.area.updateMany({ where: { id: area.id, completedAt: area.completedAt }, data: { assignedMemberId: member.id, assignedTo: member.name, dispatchedAt, completedAt: undo.completedAt ? new Date(undo.completedAt) : null, returnUndo: Prisma.DbNull, lastActivityAt: now } })
      if (updated.count !== 1) throw new TerritoryReportError('地圖狀態剛被更新，請重新整理後再試', 409)
      await close('restore')
      return { stale: false as const, sheet: area.sheetNo ? { sheetNo: area.sheetNo, member: member.name, dispatchedAt, keepDate: false } : null }
    }

    // use_sheet：以 Sheet 當時的 C/D 為準；系統持有人已不是當時的值就不套用
    const m = alert.details as SheetMismatch
    if (currentHolder(area) !== m.dbMember || (m.dbMember && taipeiDate(area.dispatchedAt) !== m.dbDate)) return stale()
    if (!m.sheetMember) {
      if (isAreaDispatched(area)) await tx.area.update({ where: { id: area.id }, data: { completedAt: now, lastActivityAt: now } })
      await close('use_sheet')
      return { stale: false as const, sheet: area.sheetNo ? { sheetNo: area.sheetNo, member: '', dispatchedAt: null, keepDate: true } : null }
    }
    const member = await tx.member.findFirst({ where: { name: m.sheetMember, deletedAt: null }, select: { id: true, name: true } })
    if (!member) throw new TerritoryReportError(`成員名單沒有「${m.sheetMember}」，請到地圖分配派發`, 409)
    const dispatchedAt = m.sheetDate ? new Date(`${m.sheetDate}T00:00:00+08:00`) : now
    await tx.area.update({ where: { id: area.id }, data: { assignedMemberId: member.id, assignedTo: member.name, dispatchedAt, completedAt: null, lastActivityAt: now } })
    await close('use_sheet')
    return { stale: false as const, sheet: area.sheetNo ? { sheetNo: area.sheetNo, member: member.name, dispatchedAt, keepDate: false } : null }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000, maxWait: 10000 })
}

/** 管理待辦列表：每則一句白話說明。 */
export function describeAlert(alert: { kind: string; details: Prisma.JsonValue }, holder: string, dispatched: string) {
  const d = (alert.details || {}) as Record<string, unknown>
  switch (alert.kind) {
    case 'not_holder': {
      const reports = (d.reports as AlertReport[] | undefined) || []
      const names = [...new Set(reports.map(r => r.name))].join('、')
      const end = reports.map(r => r.endDate).sort().pop() || ''
      return { holder: String(d.holder || holder), reporter: names, dispatched: String(d.dispatched || dispatched), endDate: end, text: `${names} 回報了 ${d.holder || holder} 領取中的地圖（結束日 ${end}），地圖還沒交回。確定是對方傳道完了就交回；回報錯號碼就按知道了。` }
    }
    case 'held_after_report':
      return { holder, reporter: '', dispatched: String(d.dispatched || dispatched), endDate: String(d.reported || ''), text: `Sheet 上有 ${d.reported} 結束的完成回報，晚於這次領取日，但地圖仍由 ${holder} 使用中。` }
    case 'return_basis_removed':
      return { holder: String(d.holder || ''), reporter: '', dispatched: taipeiDate(d.dispatchedAt ? new Date(String(d.dispatchedAt)) : null), endDate: String(d.endDate || ''), text: `這張地圖因 ${d.endDate} 結束的回報交回，但 Sheet 上已找不到這筆回報${d.reported ? `（目前最後回報 ${d.reported}）` : ''}。回報是誤填就恢復使用中，還給 ${d.holder || '原持有人'}。` }
    default:
      return { holder: String(d.dbMember || ''), reporter: '', dispatched: String(d.dbDate || ''), endDate: '', sheetMember: String(d.sheetMember || ''), text: `Sheet C 欄改成「${d.sheetMember || '空白'}」${d.sheetDate ? `（${d.sheetDate}）` : ''}，系統是「${d.dbMember || '未領取'}」${d.dbDate && d.dbMember ? `（${d.dbDate}）` : ''}，兩邊都改過。同步已先以系統為準寫回 Sheet。` }
  }
}
