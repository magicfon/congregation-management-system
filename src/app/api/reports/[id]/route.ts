import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: report, error } = await supabase
      .from('reports')
      .select('*, areas(id, name), members(id, name)')
      .eq('id', params.id)
      .single()

    if (error || !report) {
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
  try {
    const body = await request.json()
    const { status, reviewedBy, reviewedAt } = body

    const { data: existing } = await supabase
      .from('reports')
      .select('id, status')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '回報不存在' }, { status: 404 })
    }

    const { data: report, error } = await supabase
      .from('reports')
      .update({
        status: status || existing.status,
        reviewedby: reviewedBy?.trim() || null,
        reviewedat: reviewedAt ? new Date(reviewedAt).toISOString() : null,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

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
    const { data: existing } = await supabase
      .from('reports')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '回報不存在' }, { status: 404 })
    }

    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ message: '回報已刪除' })
  } catch (error) {
    console.error('DELETE /api/reports/[id] error:', error)
    return NextResponse.json({ error: '無法刪除回報' }, { status: 500 })
  }
}
