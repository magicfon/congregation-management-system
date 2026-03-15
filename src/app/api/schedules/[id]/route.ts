import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        area: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
      },
    })

    if (!schedule) return NextResponse.json({ error: '排班不存在' }, { status: 404 })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('GET /api/schedules/[id] error:', error)
    return NextResponse.json({ error: '無法取得排班資料' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { areaId, memberId, date, timeSlot, status, notes } = body

    const existing = await prisma.schedule.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: '排班不存在' }, { status: 404 })

    const schedule = await prisma.schedule.update({
      where: { id: params.id },
      data: {
        ...(areaId ? { areaId } : {}),
        ...(memberId ? { memberId } : {}),
        ...(date ? { date: new Date(date) } : {}),
        ...(timeSlot ? { timeSlot } : {}),
        ...(status ? { status } : {}),
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
      },
      include: {
        area: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
      },
    })

    // Update area lastActivityAt when schedule is completed
    if (status === 'completed') {
      await prisma.area.update({
        where: { id: schedule.areaId },
        data: { lastActivityAt: new Date() },
      })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('PUT /api/schedules/[id] error:', error)
    return NextResponse.json({ error: '無法更新排班' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.schedule.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: '排班不存在' }, { status: 404 })

    await prisma.schedule.delete({ where: { id: params.id } })

    return NextResponse.json({ message: '排班已刪除' })
  } catch (error) {
    console.error('DELETE /api/schedules/[id] error:', error)
    return NextResponse.json({ error: '無法刪除排班' }, { status: 500 })
  }
}
