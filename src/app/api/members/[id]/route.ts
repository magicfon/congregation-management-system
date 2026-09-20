import { NextRequest, NextResponse } from 'next/server'
import { memberLineFields } from '../../../../lib/member-fields'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response

  try {
    const member = await prisma.member.findUnique({
      where: { id: params.id },
      select: {
        ...memberLineFields,
        schedules: {
          include: { scheduleAreas: { include: { area: { select: { id: true, name: true } } } } },
          orderBy: { date: 'desc' },
          take: 10,
        },
        reports: {
          include: { area: { select: { id: true, name: true } } },
          orderBy: { submittedAt: 'desc' },
          take: 10,
        },
        _count: { select: { schedules: true, reports: true } },
      },
    })

    if (!member) {
      return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    }

    return NextResponse.json(member)
  } catch (error) {
    console.error('GET /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法取得成員資料' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response

  try {
    const body = await request.json()
    const { name, email, phone, active } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '姓名為必填' }, { status: 400 })
    }

    const existing = await prisma.member.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, active: true },
    })

    if (!existing) {
      return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    }

    const member = await prisma.member.update({
      select: memberLineFields,
      where: { id: params.id },
      data: {
        name: name.trim(),
        email: email?.trim() || existing.email,
        phone: phone?.trim() || null,
        active: active !== undefined ? active : existing.active,
      },
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('PUT /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法更新成員' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response

  try {
    const existing = await prisma.member.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    }

    await prisma.member.delete({ where: { id: params.id } })

    return NextResponse.json({ message: '成員已刪除' })
  } catch (error) {
    console.error('DELETE /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法刪除成員' }, { status: 500 })
  }
}
