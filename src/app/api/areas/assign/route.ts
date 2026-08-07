import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'

// POST /api/areas/assign — assign a member to an area
export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const { areaId, memberId, note } = await request.json()

    if (!areaId) {
      return NextResponse.json({ error: '缺少 areaId' }, { status: 400 })
    }

    // If memberId is null/empty, unassign
    if (!memberId) {
      const updated = await prisma.area.update({
        where: { id: areaId },
        data: {
          assignedMemberId: null,
          assignedTo: null,
          assignNote: null,
          dispatchedAt: null,
          completedAt: null,
        },
        include: { assignedMember: true }
      })
      return NextResponse.json(updated)
    }

    // Verify member exists
    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    }

    const updated = await prisma.area.update({
      where: { id: areaId },
      data: {
        assignedMemberId: memberId,
        assignedTo: member.name,
        assignNote: note || null,
        dispatchedAt: new Date(),
        completedAt: null, // reset completion when re-dispatching
        lastActivityAt: new Date(),
      },
      include: { assignedMember: true }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/areas/assign error:', error)
    return NextResponse.json({ error: '分配失敗' }, { status: 500 })
  }
}

// GET /api/areas/assign?mapId=nanzih — get assignment status for a map
export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const mapId = searchParams.get('mapId')

    const where = mapId ? { mapId } : {}
    const areas = await prisma.area.findMany({
      where,
      select: {
        id: true,
        name: true,
        mapId: true,
        mapAreaId: true,
        blockCode: true,
        assignedMemberId: true,
        assignedTo: true,
        assignNote: true,
        dispatchedAt: true,
        completedAt: true,
        lastActivityAt: true,
      },
      orderBy: { mapAreaId: 'asc' }
    })

    // A map is actively dispatched if: assignedMemberId exists AND
    // (no completedAt yet OR dispatchedAt >= completedAt)
    // If completedAt > dispatchedAt → already returned, not dispatched anymore
    const isActive = (a: typeof areas[0]) => {
      if (!a.assignedMemberId) return false
      if (!a.dispatchedAt) return true // assigned but no dispatch date → treat as active
      if (!a.completedAt) return true // dispatched, not yet completed
      return a.dispatchedAt >= a.completedAt
    }

    const areasWithStatus = areas.map(a => ({
      ...a,
      isDispatched: isActive(a),
    }))

    const total = areas.length
    const dispatched = areasWithStatus.filter(a => a.isDispatched).length

    return NextResponse.json({
      total,
      assigned: dispatched,
      unassigned: total - dispatched,
      areas: areasWithStatus
    })
  } catch (error) {
    console.error('GET /api/areas/assign error:', error)
    return NextResponse.json({ error: '無法取得分配狀態' }, { status: 500 })
  }
}
