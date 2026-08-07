import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const areas = await prisma.area.findMany({
      select: { id: true, name: true, lastActivityAt: true, assignedTo: true },
      orderBy: { lastActivityAt: 'asc' },
    })

    const now = Date.now()
    const oneDayMs = 1000 * 60 * 60 * 24

    const idleStats = areas.map(area => {
      const lastActivity = area.lastActivityAt ? new Date(area.lastActivityAt).getTime() : 0
      const idleDays = Math.floor((now - lastActivity) / oneDayMs)

      let status: 'green' | 'yellow' | 'orange' | 'red'
      if (idleDays < 7) status = 'green'
      else if (idleDays < 30) status = 'yellow'
      else if (idleDays < 90) status = 'orange'
      else status = 'red'

      return {
        areaId: area.id,
        areaName: area.name,
        idleDays,
        status,
        assignedTo: area.assignedTo || null,
        lastActivityAt: area.lastActivityAt,
      }
    })

    return NextResponse.json(idleStats)
  } catch (error) {
    console.error('GET /api/areas/idle-stats error:', error)
    return NextResponse.json({ error: '無法取得區域閒置統計' }, { status: 500 })
  }
}
