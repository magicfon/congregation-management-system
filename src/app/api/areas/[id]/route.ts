import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get area
    const { data: area, error } = await supabase
      .from('areas')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !area) {
      return NextResponse.json({ error: '區域不存在' }, { status: 404 })
    }

    // Get schedules
    const { data: schedules } = await supabase
      .from('schedules')
      .select('*, members(id, name)')
      .eq('areaId', params.id)
      .order('date', { ascending: false })
      .limit(10)

    // Get reports
    const { data: reports } = await supabase
      .from('reports')
      .select('*, members(id, name)')
      .eq('areaId', params.id)
      .order('submittedAt', { ascending: false })
      .limit(10)

    // Get counts
    const { count: schedulesCount } = await supabase
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .eq('areaId', params.id)

    const { count: reportsCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('areaId', params.id)

    const result = {
      ...area,
      schedules: schedules || [],
      reports: reports || [],
      _count: {
        schedules: schedulesCount || 0,
        reports: reportsCount || 0
      }
    }

    return NextResponse.json(result)
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

    const { data: existing } = await supabase
      .from('areas')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '區域不存在' }, { status: 404 })
    }

    const { data: area, error } = await supabase
      .from('areas')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        assignedTo: assignedTo?.trim() || null,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

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
    const { data: existing } = await supabase
      .from('areas')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '區域不存在' }, { status: 404 })
    }

    const { error } = await supabase
      .from('areas')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ message: '區域已刪除' })
  } catch (error) {
    console.error('DELETE /api/areas/[id] error:', error)
    return NextResponse.json({ error: '無法刪除區域' }, { status: 500 })
  }
}
