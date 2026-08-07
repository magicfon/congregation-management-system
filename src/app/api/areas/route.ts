import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'
import { requireApiUser, rolesAtLeast } from '../../../lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const areas = await prisma.area.findMany({
      where: search
        ? { OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ] }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { scheduleAreas: true, reports: true } },
      },
    })

    return NextResponse.json(areas)
  } catch (error) {
    console.error('GET /api/areas error:', error)
    return NextResponse.json({ error: '無法取得區域列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(rolesAtLeast('elder'))
  if ('response' in auth) return auth.response

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
      },
    })

    return NextResponse.json(area, { status: 201 })
  } catch (error) {
    console.error('POST /api/areas error:', error)
    return NextResponse.json({ error: '無法建立區域' }, { status: 500 })
  }
}
