import { Prisma, PrismaClient } from '@prisma/client'
import { isAreaDispatched } from './allocation'
import { taipeiDate } from './google-sheets'
import { reportSheetDate } from './area-report-history'
import type { ReturnUndo } from './report-alerts'
import { AlertReport, TerritoryReportError } from './territory-report'

// 退回回報（ADR-0140）：管理員在地圖列表把某區最近一筆回報整筆撤銷，還原它造成的效果

/** Sheet「傳道區域回報」的一列；row 是 Sheet 列號（標題在第 1 列）。 */
export type SheetReport = { row: number; ts: string; name: string; timeslot: string; sheetNo: number; startDate: string; endDate: string; note: string; submittedAt: Date | null }

/** 時間戳記：表單寫入「2026/11/16 上午 9:40:46」，站內寫入也可能顯示成「2026/11/16 13:00:00」；一律當台北時間。 */
export function parseSheetTimestamp(text: string): Date | null {
  const m = String(text ?? '').trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(?:(上午|下午)\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  let h = Number(m[5])
  if (m[4] === '下午' && h < 12) h += 12
  if (m[4] === '上午' && h === 12) h = 0
  const pad = (v: string | number) => String(v).padStart(2, '0')
  const date = new Date(`${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(h)}:${m[6]}:${pad(m[7] || 0)}+08:00`)
  return Number.isFinite(date.getTime()) ? date : null
}

/** values 是 A2:G 讀回的值。 */
export function parseReportRows(values: string[][]): SheetReport[] {
  const rows: SheetReport[] = []
  values.forEach((cells, i) => {
    const sheetNo = Number(cells[3])
    const endDate = reportSheetDate(cells[5])
    if (!Number.isInteger(sheetNo) || sheetNo < 1 || !endDate) return
    const ts = String(cells[0] ?? '').trim()
    rows.push({ row: i + 2, ts, name: String(cells[1] ?? '').trim(), timeslot: String(cells[2] ?? '').trim(), sheetNo, startDate: reportSheetDate(cells[4]) || '', endDate, note: String(cells[6] ?? '').trim(), submittedAt: parseSheetTimestamp(ts) })
  })
  return rows
}

/** 退回時用來確認 Sheet 那一列沒被動過。 */
export const reportKey = (r: SheetReport) => [r.row, r.ts, r.sheetNo, r.name, r.endDate].join('|')

/** 每區最近一筆：送出時間最晚的；時間相同或無法解析時，列號較後的較新。 */
export function latestReports(rows: SheetReport[]) {
  const latest = new Map<number, SheetReport>()
  for (const r of rows) {
    const cur = latest.get(r.sheetNo)
    const t = r.submittedAt?.getTime() ?? -Infinity, c = cur?.submittedAt?.getTime() ?? -Infinity
    if (!cur || t > c || (t === c && r.row > cur.row)) latest.set(r.sheetNo, r)
  }
  return latest
}

/** 依結束日最新的回報（同日取送出較晚的）。 */
function newestByEnd(rows: SheetReport[]) {
  return [...rows].sort((a, b) => b.endDate.localeCompare(a.endDate) || (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0) || b.row - a.row)[0] || null
}

type PlanArea = { assignedMemberId: string | null; dispatchedAt: Date | null; completedAt: Date | null; personalManaged?: boolean; returnUndo: Prisma.JsonValue | null }

/**
 * 退回後這區要變成什麼樣子（不寫入）。
 * - restore：這筆回報讓地圖交回，且之後沒再派發或收回 → 用交回前保存的狀態恢復使用中。
 * - notRestored：這筆回報交回過地圖，但之後已重新派發／收回，地圖分配不動。
 * - managedStart：個人管理的地圖，退回的是最新一次回報 → 領取日改回剩下最新一筆的開始日。
 * - lastReportedCompletedAt：剩下回報中最晚的結束日（與 Sheet E 欄公式相同）。
 */
export function planWithdraw(area: PlanArea, target: SheetReport, remaining: SheetReport[]) {
  const others = remaining.filter(r => r.sheetNo === target.sheetNo && r.row !== target.row)
  const last = newestByEnd(others)
  const lastReportedCompletedAt = last ? new Date(`${last.endDate}T00:00:00+08:00`) : null
  const undo = area.returnUndo as ReturnUndo | null
  const matches = Boolean(undo?.returnedAt && undo.endDate === target.endDate)
  const restorable = matches && !isAreaDispatched(area) && area.completedAt?.toISOString() === undo!.returnedAt
  let managedStart: Date | null = null
  if (area.personalManaged && isAreaDispatched(area) && newestByEnd([...others, target])?.row === target.row && last?.startDate) managedStart = new Date(`${last.startDate}T00:00:00+08:00`)
  return { lastReportedCompletedAt, restore: restorable ? undo : null, notRestored: matches && !restorable, managedStart, managedNoPrevious: Boolean(area.personalManaged && isAreaDispatched(area) && !managedStart && newestByEnd([...others, target])?.row === target.row) }
}

const NEAR_MS = 5000
const near = (a: Date | null | undefined, b: Date | null) => Boolean(a && b && Math.abs(a.getTime() - b.getTime()) <= NEAR_MS)

/** 站內送出的回報在系統留的紀錄：同區、同期間，送出時間與 Sheet 時間戳記相差幾秒內。 */
export function matchesReportRecord(record: { content: string; submittedAt: Date }, target: SheetReport) {
  if (!near(record.submittedAt, target.submittedAt)) return false
  try {
    const c = JSON.parse(record.content)
    return c.source === 'territory-report' && Number(c.sheetNo) === target.sheetNo && c.endDate === target.endDate && (!target.startDate || c.startDate === target.startDate)
  } catch { return false }
}

export type WithdrawResult = { sheetNo: number; done: string[]; sheet: { member: string; dispatchedAt: Date } | null }
type Tx = Prisma.TransactionClient

/**
 * 退回一筆回報。Sheet 刪列放在交易最後一步，失敗則整筆回滾；
 * 區域狀態 C/D 由呼叫端在交易後寫回，失敗時 cron 推送補救會補上。
 */
export async function withdrawReport(db: PrismaClient, target: SheetReport, allRows: SheetReport[], admin: string, deleteRow: () => Promise<void>, now = new Date()): Promise<WithdrawResult> {
  return db.$transaction(async (tx: Tx) => {
    const area = await tx.area.findUnique({ where: { sheetNo: target.sheetNo }, include: { assignedMember: { select: { name: true } } } })
    if (!area) throw new TerritoryReportError(`找不到區域號碼 ${target.sheetNo}`, 404)
    const plan = planWithdraw(area, target, allRows)
    const done: string[] = ['刪除 Sheet「傳道區域回報」這一列']
    let sheet: WithdrawResult['sheet'] = null

    const guard = { id: area.id, assignedMemberId: area.assignedMemberId, dispatchedAt: area.dispatchedAt, completedAt: area.completedAt }
    const data: Prisma.AreaUncheckedUpdateManyInput = { lastReportedCompletedAt: plan.lastReportedCompletedAt, lastActivityAt: now }
    if (plan.restore) {
      const undo = plan.restore
      const member = undo.memberId ? await tx.member.findFirst({ where: { id: undo.memberId, deletedAt: null }, select: { id: true, name: true } }) : null
      if (!member) throw new TerritoryReportError('原持有人已不在成員名單，無法恢復使用中；請先到地圖分配處理', 409)
      const dispatchedAt = undo.dispatchedAt ? new Date(undo.dispatchedAt) : now
      Object.assign(data, { assignedMemberId: member.id, assignedTo: member.name, dispatchedAt, completedAt: undo.completedAt ? new Date(undo.completedAt) : null, returnUndo: Prisma.DbNull })
      sheet = { member: member.name, dispatchedAt }
      done.push(`地圖恢復由 ${member.name} 使用中（領取日 ${taipeiDate(dispatchedAt)}）`)
      await tx.reportAlert.updateMany({ where: { areaId: area.id, kind: 'return_basis_removed', cycleKey: undo.returnedAt, status: 'pending' }, data: { status: 'resolved', resolvedAt: now, resolvedBy: admin, resolution: 'withdrawn', updatedAt: now } })
    } else if (plan.notRestored) {
      done.push('這筆回報交回的地圖之後已重新分發或收回，地圖分配不變')
    }
    if (plan.managedStart) {
      data.dispatchedAt = plan.managedStart
      sheet = { member: area.assignedMember?.name || area.assignedTo || '', dispatchedAt: plan.managedStart }
      done.push(`個人管理領取日改回 ${taipeiDate(plan.managedStart)}`)
    } else if (plan.managedNoPrevious) {
      done.push('個人管理沒有更早的回報，領取日不變')
    }
    const updated = await tx.area.updateMany({ where: guard, data })
    if (updated.count !== 1) throw new TerritoryReportError('地圖狀態剛被更新，請重新整理後再試', 409)
    done.push(plan.lastReportedCompletedAt ? `最後完成日改為 ${taipeiDate(plan.lastReportedCompletedAt)}` : '最後完成日清空（已無其他回報）')

    // 系統回報紀錄（站內送出的才有）
    const records = (await tx.report.findMany({ where: { areaId: area.id, submittedAt: { gte: new Date((target.submittedAt?.getTime() ?? 0) - NEAR_MS), lte: new Date((target.submittedAt?.getTime() ?? 0) + NEAR_MS) } }, select: { id: true, content: true, submittedAt: true } })).filter(r => matchesReportRecord(r, target))
    if (records[0]) { await tx.report.delete({ where: { id: records[0].id } }); done.push('刪除系統回報紀錄') }

    // 回報待確認：拿掉這筆回報；沒有其他回報就結案
    const alerts = await tx.reportAlert.findMany({ where: { areaId: area.id, kind: { in: ['not_holder', 'not_holder_returned'] } } })
    for (const alert of alerts) {
      const details = (alert.details || {}) as { reports?: AlertReport[]; holderReturned?: { name?: string; endDate?: string } }
      const reports = details.reports || []
      const kept = reports.filter(r => !(r.name === target.name && r.endDate === target.endDate))
      const back = details.holderReturned
      const holderWithdrawn = alert.kind === 'not_holder_returned' && back?.endDate === target.endDate && (back.name === target.name || back.name === area.assignedMember?.name)
      const changed = kept.length < reports.length || holderWithdrawn
      if (alert.status === 'pending' && changed) {
        const { holderReturned: _, ...rest } = details
        const next = { ...(holderWithdrawn ? rest : details), reports: kept }
        const closed = { details: next, status: 'resolved', resolvedAt: now, resolvedBy: admin, resolution: 'withdrawn', updatedAt: now }
        if (!kept.length) await tx.reportAlert.update({ where: { id: alert.id }, data: closed })
        else if (holderWithdrawn) {
          // 本人交回的那筆被退回：回到「回報他人地圖」，同一輪已有另一則就直接結案
          const clash = await tx.reportAlert.findUnique({ where: { areaId_kind_cycleKey: { areaId: area.id, kind: 'not_holder', cycleKey: alert.cycleKey } } })
          await tx.reportAlert.update({ where: { id: alert.id }, data: clash ? closed : { kind: 'not_holder', details: next, updatedAt: now } })
        } else await tx.reportAlert.update({ where: { id: alert.id }, data: { details: next, updatedAt: now } })
        done.push(kept.length ? '回報待確認移除這筆回報' : '回報待確認結案')
      } else if (alert.status === 'resolved' && alert.resolution === 'admin_reported' && near(alert.resolvedAt, target.submittedAt)) {
        // 管理員代為回報時順手結案的待確認：重新開啟，交還管理員判斷
        await tx.reportAlert.update({ where: { id: alert.id }, data: { status: 'pending', resolvedAt: null, resolvedBy: null, resolution: null, updatedAt: now } })
        done.push('重新開啟先前的回報待確認')
      }
    }

    // 拒訪待審：同一次送出附上的地址
    if (target.submittedAt) {
      const dnv = await tx.doNotVisitReport.deleteMany({ where: { areaId: area.id, status: 'pending', createdAt: { gte: new Date(target.submittedAt.getTime() - NEAR_MS), lte: new Date(target.submittedAt.getTime() + NEAR_MS) } } })
      if (dnv.count) done.push(`刪除拒訪待審 ${dnv.count} 筆`)
    }

    await deleteRow()
    return { sheetNo: target.sheetNo, done, sheet }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000, maxWait: 10000 })
}
