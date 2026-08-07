import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'
import { requireApiUser, rolesAtLeast } from '../../../lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const areaId = searchParams.get('areaId')
    const memberId = searchParams.get('memberId')

    const reports = await prisma.report.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(areaId ? { areaId } : {}),
        ...(memberId ? { memberId } : {}),
      },
      include: {
        area: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    })

    return NextResponse.json(reports)
  } catch (error) {
    console.error('GET /api/reports error:', error)
    return NextResponse.json({ error: '無法取得回報列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const body = await request.json()
    const { areaId, memberId, content, status } = body

    if (!areaId?.trim() || !memberId?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '區域、成員和內容為必填' }, { status: 400 })
    }

    const report = await prisma.report.create({
      data: {
        areaId: areaId.trim(),
        memberId: memberId.trim(),
        content: content.trim(),
        status: status || 'pending',
      },
    })

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('POST /api/reports error:', error)
    return NextResponse.json({ error: '無法建立回報' }, { status: 500 })
  }
}
