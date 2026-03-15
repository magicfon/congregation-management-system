import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const report = await supabase.from("reports").findUnique({
      where: { id: params.id },
      include: {
        area: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
      },
    })

    if (!report) return NextResponse.json({ error: '回報不存在' }, { status: 404 })

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
  try {
    const body = await request.json()
    const { content, status, reviewedBy } = body

    const existing = await supabase.from("reports").findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: '回報不存在' }, { status: 404 })

    const isReviewing = status === 'reviewed' || status === 'approved'

    const report = await supabase.from("reports").update({
      where: { id: params.id },
      data: {
        ...(content !== undefined ? { content: content.trim() } : {}),
        ...(status ? { status } : {}),
        ...(isReviewing
          ? {
              reviewedBy: reviewedBy ?? existing.reviewedBy,
              reviewedAt: existing.reviewedAt ?? new Date(),
            }
          : {}),
      },
      include: {
        area: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
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
  try {
    const existing = await supabase.from("reports").findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: '回報不存在' }, { status: 404 })

    await supabase.from("reports").delete({ where: { id: params.id } })

    return NextResponse.json({ message: '回報已刪除' })
  } catch (error) {
    console.error('DELETE /api/reports/[id] error:', error)
    return NextResponse.json({ error: '無法刪除回報' }, { status: 500 })
  }
}
