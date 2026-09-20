import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
import { allocationOrder, idleCalendarDays, isAreaDispatched } from '../../../../lib/allocation'
import { taipeiDate, readValues, DEFAULT_SHEET_ID } from '../../../../lib/google-sheets'
import { COMPLETION_SYNC_KEY, syncReportCompletions } from '../../../../lib/report-completion-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const [areas, sync] = await Promise.all([
      prisma.area.findMany({ select: {
        id: true, name: true, mapId: true, mapAreaId: true, sheetNo: true, blockCode: true,
        assignedMemberId: true, assignedTo: true, dispatchedAt: true, completedAt: true,
        lastReportedCompletedAt: true, assignedMember: { select: { name: true } },
      } }),
      prisma.setting.findUnique({ where: { key: COMPLETION_SYNC_KEY } }),
    ])
    const today = taipeiDate(new Date())
    return NextResponse.json({
      syncedAt: sync?.value || null,
      areas: areas.sort(allocationOrder).map((area) => {
        const lastCompletedDate = taipeiDate(area.lastReportedCompletedAt) || null
        return {
          id: area.id, name: area.name, mapId: area.mapId, mapAreaId: area.mapAreaId,
          sheetNo: area.sheetNo, blockCode: area.blockCode,
          assignedTo: area.assignedMember?.name || area.assignedTo,
          isDispatched: isAreaDispatched(area), lastCompletedDate,
          idleDays: idleCalendarDays(lastCompletedDate, today),
        }
      }),
    })
  } catch (error) {
    console.error('Allocation overview failed:', error)
    return NextResponse.json({ error: '無法載入地圖清單' }, { status: 500 })
  }
}

// Refresh only Sheet E -> DB completion dates. Never edits assignments or Sheet.
export async function POST() {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    const rows = await readValues(DEFAULT_SHEET_ID, '區域狀態!A2:E214')
    return NextResponse.json(await syncReportCompletions(prisma, rows))
  } catch (error) {
    console.error('Completion date refresh failed:', error)
    return NextResponse.json({ error: '回報日期同步失敗，請檢查 Sheet 日期及 213 區完整性；已保留原資料。' }, { status: 500 })
  }
}
