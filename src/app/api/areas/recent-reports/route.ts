import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
import { readValues, DEFAULT_SHEET_ID } from '../../../../lib/google-sheets'
import { latestReports, parseReportRows, planWithdraw, reportKey } from '../../../../lib/report-withdraw'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/areas/recent-reports — 地圖列表「最近回報」欄：每區最近一筆（ADR-0140）。退回的預覽只給管理員
export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  const admin = auth.user.role === 'admin'
  try {
    const rows = parseReportRows(await readValues(DEFAULT_SHEET_ID, '傳道區域回報!A2:G'))
    const latest = latestReports(rows)
    const areas = admin ? await prisma.area.findMany({ where: { sheetNo: { in: [...latest.keys()] } }, select: { sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true, personalManaged: true, returnUndo: true } }) : []
    const bySheetNo = new Map(areas.map(a => [a.sheetNo!, a]))
    const reports = Object.fromEntries([...latest].map(([sheetNo, r]) => {
      const base = { name: r.name, startDate: r.startDate, endDate: r.endDate, submittedAt: r.submittedAt?.toISOString() ?? null }
      const area = bySheetNo.get(sheetNo)
      if (!admin || !area) return [sheetNo, base]
      const plan = planWithdraw(area, r, rows)
      return [sheetNo, { ...base, row: r.row, key: reportKey(r), restoreTo: plan.restore ? { holder: plan.restore.holder, dispatched: plan.restore.dispatchedAt } : null, notRestored: plan.notRestored, managedStart: plan.managedStart?.toISOString() ?? null, lastCompleted: plan.lastReportedCompletedAt?.toISOString() ?? null }]
    }))
    return NextResponse.json({ reports }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Recent reports failed:', error)
    return NextResponse.json({ error: '無法讀取最近回報' }, { status: 503 })
  }
}
