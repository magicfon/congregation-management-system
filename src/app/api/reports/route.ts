import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get('areaId')
    const memberId = searchParams.get('memberId')
    const status = searchParams.get('status')

    const reports = await supabase.from("reports").findMany({
      where: {
        ...(areaId ? { areaId } : {}),
        ...(memberId ? { memberId } : {}),
        ...(status ? { status } : {}),
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
  try {
    const body = await request.json()
    const { areaId, memberId, content } = body

    if (!areaId) return NextResponse.json({ error: '區域為必填' }, { status: 400 })
    if (!memberId) return NextResponse.json({ error: '成員為必填' }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: '回報內容為必填' }, { status: 400 })

    const report = await supabase.from("reports").create({
      data: {
        areaId,
        memberId,
        content: content.trim(),
        status: 'pending',
      },
      include: {
        area: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
      },
    })

    // Update area lastActivityAt on new report
    await supabase.from("areas").update({
      where: { id: areaId },
      data: { lastActivityAt: new Date() },
    })

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('POST /api/reports error:', error)
    return NextResponse.json({ error: '無法提交回報' }, { status: 500 })
  }
}
