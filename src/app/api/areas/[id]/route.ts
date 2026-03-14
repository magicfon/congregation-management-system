import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const area = await prisma.area.findUnique({
      where: { id: params.id },
      include: {
        schedules: {
          include: { member: { select: { id: true, name: true } } },
          orderBy: { date: 'desc' },
          take: 10,
        },
        reports: {
          include: { member: { select: { id: true, name: true } } },
          orderBy: { submittedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { schedules: true, reports: true },
        },
      },
    })

    if (!area) {
      return NextResponse.json({ error: '區域不存在' }, { status: 404 })
    }

    return NextResponse.json(area)
  } catch (error) {
    console.error('GET /api/areas/[id] error:', error)
    return NextResponse.json({ error: '無法取得區域資料' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, description, assignedTo } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '區域名稱為必填' }, { status: 400 })
    }

    const existing = await prisma.area.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: '區域不存在' }, { status: 404 })
    }

    const area = await prisma.area.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        assignedTo: assignedTo?.trim() || null,
      },
    })

    return NextResponse.json(area)
  } catch (error) {
    console.error('PUT /api/areas/[id] error:', error)
    return NextResponse.json({ error: '無法更新區域' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.area.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: '區域不存在' }, { status: 404 })
    }

    await prisma.area.delete({ where: { id: params.id } })

    return NextResponse.json({ message: '區域已刪除' })
  } catch (error) {
    console.error('DELETE /api/areas/[id] error:', error)
    return NextResponse.json({ error: '無法刪除區域' }, { status: 500 })
  }
}
