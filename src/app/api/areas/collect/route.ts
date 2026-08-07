import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'

// POST /api/areas/collect — batch collect (return) areas from members
// Admin only. Sets completedAt = now() and clears assignment.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response

  try {
    const { areaIds } = await request.json() as { areaIds: string[] }

    if (!areaIds || !Array.isArray(areaIds) || areaIds.length === 0) {
      return NextResponse.json({ error: '缺少 areaIds' }, { status: 400 })
    }

    const now = new Date()

    // Batch update: set completedAt and clear assignment
    const result = await prisma.area.updateMany({
      where: { id: { in: areaIds } },
      data: {
        completedAt: now,
        lastActivityAt: now,
      },
    })

    return NextResponse.json({
      collected: result.count,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('POST /api/areas/collect error:', error)
    return NextResponse.json({ error: '收回失敗' }, { status: 500 })
  }
}
