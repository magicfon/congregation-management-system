import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const areaId = searchParams.get('areaId')
    const memberId = searchParams.get('memberId')

    let query = supabase
      .from('reports')
      .select('*, areas(id, name), members(id, name)')

    if (status) {
      query = query.eq('status', status)
    }

    if (areaId) {
      query = query.eq('areaid', areaId)
    }

    if (memberId) {
      query = query.eq('memberid', memberId)
    }

    const { data: reports, error } = await query.order('submittedat', { ascending: false })

    if (error) throw error

    return NextResponse.json(reports)
  } catch (error) {
    console.error('GET /api/reports error:', error)
    return NextResponse.json({ error: '無法取得回報列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { areaId, memberId, content, status } = body

    if (!areaId?.trim() || !memberId?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '區域、成員和內容為必填' }, { status: 400 })
    }

    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        areaid: areaId.trim(),
        memberid: memberId.trim(),
        content: content.trim(),
        status: status || 'pending',
        submittedat: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('POST /api/reports error:', error)
    return NextResponse.json({ error: '無法建立回報' }, { status: 500 })
  }
}
