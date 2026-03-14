import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const areas = await prisma.area.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: {
            schedules: true,
            reports: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(areas)
  } catch (error) {
    console.error('GET /api/areas error:', error)
    return NextResponse.json({ error: '無法取得區域列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, assignedTo } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '區域名稱為必填' }, { status: 400 })
    }

    const area = await prisma.area.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        assignedTo: assignedTo?.trim() || null,
        lastActivityAt: new Date(),
      },
    })

    return NextResponse.json(area, { status: 201 })
  } catch (error) {
    console.error('POST /api/areas error:', error)
    return NextResponse.json({ error: '無法建立區域' }, { status: 500 })
  }
}
