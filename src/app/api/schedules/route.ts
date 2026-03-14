import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get('areaId')
    const memberId = searchParams.get('memberId')
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const schedules = await prisma.schedule.findMany({
      where: {
        ...(areaId ? { areaId } : {}),
        ...(memberId ? { memberId } : {}),
        ...(status ? { status } : {}),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        area: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('GET /api/schedules error:', error)
    return NextResponse.json({ error: '無法取得排班列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { areaId, memberId, date, timeSlot, notes } = body

    if (!areaId) return NextResponse.json({ error: '區域為必填' }, { status: 400 })
    if (!memberId) return NextResponse.json({ error: '成員為必填' }, { status: 400 })
    if (!date) return NextResponse.json({ error: '日期為必填' }, { status: 400 })
    if (!timeSlot) return NextResponse.json({ error: '時段為必填' }, { status: 400 })

    const schedule = await prisma.schedule.create({
      data: {
        areaId,
        memberId,
        date: new Date(date),
        timeSlot,
        notes: notes?.trim() || null,
        status: 'scheduled',
      },
      include: {
        area: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('POST /api/schedules error:', error)
    return NextResponse.json({ error: '無法建立排班' }, { status: 500 })
  }
}
