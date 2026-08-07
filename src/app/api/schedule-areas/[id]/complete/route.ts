import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db'
import { requireApiUser } from '../../../../../lib/api-auth'

// POST /api/schedule-areas/[id]/complete — 標記行程中的區域完成
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const { completed, memberId } = body

    const existing = await prisma.scheduleArea.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: '記錄不存在' }, { status: 404 })
    }

    const isCompleted = completed !== undefined ? completed : true

    const updated = await prisma.scheduleArea.update({
      where: { id: params.id },
      data: {
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedById: isCompleted ? (memberId || auth.user.id || null) : null,
      },
    })

    // Update area lastActivityAt when completed
    if (isCompleted) {
      await prisma.area.update({
        where: { id: existing.areaId },
        data: { lastActivityAt: new Date() },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/schedule-areas/[id]/complete error:', error)
    return NextResponse.json({ error: '回報失敗' }, { status: 500 })
  }
}
