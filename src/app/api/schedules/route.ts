import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'
import { requireApiUser, rolesAtLeast } from '../../../lib/api-auth'

// GET /api/schedules — list all schedules
export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const schedules = await prisma.schedule.findMany({
      include: {
        leader: true,
        scheduleAreas: {
          include: {
            area: { select: { id: true, name: true, mapId: true, mapAreaId: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('GET /api/schedules error:', error)
    return NextResponse.json({ error: '無法取得行程列表' }, { status: 500 })
  }
}

// POST /api/schedules — create a new schedule
export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const body = await request.json()
    const {
      date,
      timeSlot,
      timeStart,
      timeEnd,
      group,
      leaderId,
      preMeetingType,
      preMeetingTime,
      meetingLocation,
      areaIds,
      notes,
    } = body

    if (!date) {
      return NextResponse.json({ error: '日期為必填' }, { status: 400 })
    }

    const schedule = await prisma.schedule.create({
      data: {
        date: new Date(date),
        timeSlot: timeSlot || 'morning',
        timeStart: timeStart || null,
        timeEnd: timeEnd || null,
        group: group || '集體',
        leaderId: leaderId || null,
        preMeetingType: preMeetingType || null,
        preMeetingTime: preMeetingTime || null,
        meetingLocation: meetingLocation || null,
        notes: notes || null,
        scheduleAreas: areaIds?.length
          ? {
              create: areaIds.map((areaId: string) => ({ areaId })),
            }
          : undefined,
      },
      include: {
        leader: true,
        scheduleAreas: {
          include: {
            area: { select: { id: true, name: true, mapId: true, mapAreaId: true } },
          },
        },
      },
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('POST /api/schedules error:', error)
    return NextResponse.json({ error: '建立行程失敗' }, { status: 500 })
  }
}
