import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'

// GET /api/areas/dispatched — get all actively dispatched areas grouped by member
export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const areas = await prisma.area.findMany({
      where: { assignedMemberId: { not: null } },
      select: {
        id: true,
        name: true,
        mapId: true,
        mapAreaId: true,
        blockCode: true,
        sheetNo: true,
        assignedMemberId: true,
        assignedTo: true,
        assignNote: true,
        dispatchedAt: true,
        completedAt: true,
      },
      orderBy: [{ assignedTo: 'asc' }, { mapId: 'asc' }, { mapAreaId: 'asc' }]
    })

    // Filter to only actively dispatched
    const isActive = (a: typeof areas[0]) => {
      if (!a.assignedMemberId) return false
      if (!a.dispatchedAt) return true // assigned but no dispatch date → treat as active
      if (!a.completedAt) return true
      return a.dispatchedAt >= a.completedAt
    }

    const active = areas.filter(isActive)

    // Group by member
    const byMember: Record<string, {
      memberId: string
      memberName: string
      count: number
      areas: typeof active
    }> = {}

    for (const a of active) {
      const mid = a.assignedMemberId!
      if (!byMember[mid]) {
        byMember[mid] = {
          memberId: mid,
          memberName: a.assignedTo || '未知',
          count: 0,
          areas: [],
        }
      }
      byMember[mid].areas.push(a)
      byMember[mid].count++
    }

    // Convert to sorted array
    const groups = Object.values(byMember).sort((a, b) => b.count - a.count)

    return NextResponse.json({
      totalDispatched: active.length,
      memberCount: groups.length,
      groups,
    })
  } catch (error) {
    console.error('GET /api/areas/dispatched error:', error)
    return NextResponse.json({ error: '無法取得分發資料' }, { status: 500 })
  }
}
