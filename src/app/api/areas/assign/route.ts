import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
import { pushAreaCD, updateSnapshot, DEFAULT_SHEET_ID } from '../../../../lib/google-sheets'

/**
 * DB → Sheet 即時推送（失敗不阻擋 DB 操作，靠 cron 補救）
 * 回收/清除：C 清空、D 保留（下次分發覆蓋）
 */
async function pushToSheet(area: { sheetNo: number | null }, collected: boolean) {
  if (!area.sheetNo) return
  try {
    if (collected) {
      // 清 C、保留 D：先讀不必要——D 不動，只寫 C
      const { updateValues } = await import('../../../../lib/google-sheets')
      await updateValues(DEFAULT_SHEET_ID, `區域狀態!C${area.sheetNo + 1}:C${area.sheetNo + 1}`, [['']])
      await updateSnapshot([{ sheetNo: area.sheetNo, member: '', date: null, keepDate: true }])
    }
  } catch (e) {
    console.error('pushToSheet(collect) failed (cron 會補救):', e)
  }
}

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
      void pushToSheet(updated, true)
      return NextResponse.json(updated)
    }

    // Verify member exists
    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    }

    const now = new Date()
    const updated = await prisma.area.update({
      where: { id: areaId },
      data: {
        assignedMemberId: memberId,
        assignedTo: member.name,
        assignNote: note || null,
        dispatchedAt: now,
        completedAt: null, // reset completion when re-dispatching
        lastActivityAt: now,
      },
      include: { assignedMember: true }
    })

    // DB → Sheet 即時推送 C/D（fire-and-forget）
    if (updated.sheetNo) {
      try {
        await pushAreaCD(DEFAULT_SHEET_ID, updated.sheetNo, member.name, now)
        await updateSnapshot([{ sheetNo: updated.sheetNo, member: member.name, date: now }])
      } catch (e) {
        console.error('assign pushToSheet failed (cron 會補救):', e)
      }
    }

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
