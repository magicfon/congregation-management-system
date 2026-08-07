import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'

export async function GET() {
  try {
    const [areaCount, memberCount, scheduleCount, reportCount, recentAreas] =
      await Promise.all([
        prisma.area.count(),
        prisma.member.count(),
        prisma.schedule.count(),
        prisma.report.count(),
        prisma.area.findMany({
          select: {
            id: true, name: true, lastActivityAt: true, assignedTo: true,
          },
          orderBy: { lastActivityAt: 'asc' },
          take: 5,
        }),
      ])

    return NextResponse.json({
      areaCount,
      memberCount,
      scheduleCount,
      reportCount,
      recentAreas,
    })
  } catch (error) {
    console.error('GET /api/statistics error:', error)
    return NextResponse.json({ error: '無法取得統計資料' }, { status: 500 })
  }
}
