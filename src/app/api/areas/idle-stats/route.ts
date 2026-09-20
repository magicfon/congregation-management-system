import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
import { allocationOrder, idleCalendarDays } from '../../../../lib/allocation'
import { taipeiDate } from '../../../../lib/google-sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const areas = await prisma.area.findMany({
      select: { id: true, name: true, lastReportedCompletedAt: true, assignedTo: true, mapId: true, blockCode: true, sheetNo: true, mapAreaId: true },
    })

    const today = taipeiDate(new Date())

    const idleStats = areas.sort(allocationOrder).map(area => {
      const idleDays = idleCalendarDays(taipeiDate(area.lastReportedCompletedAt) || null, today)

      let status: 'green' | 'yellow' | 'red' | 'unknown'
      if (idleDays === null) status = 'unknown'
      else if (idleDays < 90) status = 'green'
      else if (idleDays < 180) status = 'yellow'
      else status = 'red'

      return {
        areaId: area.id,
        areaName: area.name,
        idleDays,
        status,
        assignedTo: area.assignedTo || null,
        lastCompletedAt: area.lastReportedCompletedAt,
      }
    })

    return NextResponse.json(idleStats)
  } catch (error) {
    console.error('GET /api/areas/idle-stats error:', error)
    return NextResponse.json({ error: '無法取得區域閒置統計' }, { status: 500 })
  }
}
