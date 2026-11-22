import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
import { readValues, DEFAULT_SHEET_ID } from '../../../../lib/google-sheets'
import { latestReports, parseReportRows, planWithdraw, reportKey } from '../../../../lib/report-withdraw'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LIMIT = 30

// GET /api/areas/recent-reports — 地圖列表「最近回報」區塊：全部地圖依送出時間由新到舊（ADR-0140 修訂）。
// 只有每區最新的一筆能退回；退回的預覽只給管理員
export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  const admin = auth.user.role === 'admin'
  try {
    const rows = parseReportRows(await readValues(DEFAULT_SHEET_ID, '傳道區域回報!A2:G'))
    const latest = latestReports(rows)
    const recent = [...rows].sort((a, b) => (b.submittedAt?.getTime() ?? -Infinity) - (a.submittedAt?.getTime() ?? -Infinity) || b.row - a.row).slice(0, LIMIT)
    const areas = admin ? await prisma.area.findMany({ where: { sheetNo: { in: [...new Set(recent.map(r => r.sheetNo))] } }, select: { sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true, personalManaged: true, returnUndo: true } }) : []
    const bySheetNo = new Map(areas.map(a => [a.sheetNo!, a]))
    const reports = recent.map(r => {
      const isLatest = latest.get(r.sheetNo)?.row === r.row
      const base = { sheetNo: r.sheetNo, name: r.name, startDate: r.startDate, endDate: r.endDate, submittedAt: r.submittedAt?.toISOString() ?? null, latest: isLatest }
      const area = bySheetNo.get(r.sheetNo)
      if (!admin || !area || !isLatest) return base
      const plan = planWithdraw(area, r, rows)
      return { ...base, key: reportKey(r), restoreTo: plan.restore ? { holder: plan.restore.holder, dispatched: plan.restore.dispatchedAt } : null, notRestored: plan.notRestored, managedStart: plan.managedStart?.toISOString() ?? null, lastCompleted: plan.lastReportedCompletedAt?.toISOString() ?? null }
    })
    return NextResponse.json({ reports }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Recent reports failed:', error)
    return NextResponse.json({ error: '無法讀取最近回報' }, { status: 503 })
  }
}
