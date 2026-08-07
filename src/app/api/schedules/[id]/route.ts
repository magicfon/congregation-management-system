import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'

// GET /api/schedules/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        leader: true,
        scheduleAreas: {
          include: {
            area: { select: { id: true, name: true, mapId: true, mapAreaId: true } },
          },
        },
      },
    })

    if (!schedule) {
      return NextResponse.json({ error: '行程不存在' }, { status: 404 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('GET /api/schedules/[id] error:', error)
    return NextResponse.json({ error: '無法取得行程' }, { status: 500 })
  }
}

// PUT /api/schedules/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      status,
      notes,
      areaIds,
    } = body

    // Update scheduleAreas if provided
    if (areaIds !== undefined) {
      // Delete existing
      await prisma.scheduleArea.deleteMany({ where: { scheduleId: params.id } })
      // Create new
      if (areaIds.length > 0) {
        await prisma.scheduleArea.createMany({
          data: areaIds.map((areaId: string) => ({
            scheduleId: params.id,
            areaId,
          })),
        })
      }
    }

    const schedule = await prisma.schedule.update({
      where: { id: params.id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(timeSlot !== undefined && { timeSlot }),
        ...(timeStart !== undefined && { timeStart }),
        ...(timeEnd !== undefined && { timeEnd }),
        ...(group !== undefined && { group }),
        ...(leaderId !== undefined && { leaderId: leaderId || null }),
        ...(preMeetingType !== undefined && { preMeetingType }),
        ...(preMeetingTime !== undefined && { preMeetingTime }),
        ...(meetingLocation !== undefined && { meetingLocation }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
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

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('PUT /api/schedules/[id] error:', [] )
    return NextResponse.json({ error: '更新行程失敗' }, { status: 500 })
  }
}

// DELETE /api/schedules/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    await prisma.schedule.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/schedules/[id] error:', error)
    return NextResponse.json({ error: '刪除行程失敗' }, { status: 500 })
  }
}
