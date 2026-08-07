import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { requireApiUser, rolesAtLeast } from '../../../../lib/api-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const report = await prisma.report.findUnique({
      where: { id: params.id },
      include: {
        area: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
      },
    })

    if (!report) {
      return NextResponse.json({ error: '回報不存在' }, { status: 404 })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('GET /api/reports/[id] error:', error)
    return NextResponse.json({ error: '無法取得回報資料' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser(rolesAtLeast('elder'))
  if ('response' in auth) return auth.response

  try {
    const body = await request.json()
    const { status, reviewedBy, reviewedAt } = body

    const existing = await prisma.report.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: '回報不存在' }, { status: 404 })
    }

    const report = await prisma.report.update({
      where: { id: params.id },
      data: {
        status: status || existing.status,
        reviewedBy: reviewedBy?.trim() || null,
        reviewedAt: reviewedAt ? new Date(reviewedAt) : null,
      },
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('PUT /api/reports/[id] error:', error)
    return NextResponse.json({ error: '無法更新回報' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser(rolesAtLeast('elder'))
  if ('response' in auth) return auth.response

  try {
    const existing = await prisma.report.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: '回報不存在' }, { status: 404 })
    }

    await prisma.report.delete({ where: { id: params.id } })

    return NextResponse.json({ message: '回報已刪除' })
  } catch (error) {
    console.error('DELETE /api/reports/[id] error:', error)
    return NextResponse.json({ error: '無法刪除回報' }, { status: 500 })
  }
}
