import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !member) {
      return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    }

    // Get schedules
    const { data: schedules } = await supabase
      .from('schedules')
      .select('*, members(id, name)')
      .eq('memberid', params.id)
      .order('date', { ascending: false })
      .limit(10)

    // Get reports
    const { data: reports } = await supabase
      .from('reports')
      .select('*, members(id, name)')
      .eq('memberid', params.id)
      .order('submittedat', { ascending: false })
      .limit(10)

    // Get counts
    const { count: schedulesCount } = await supabase
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .eq('memberid', params.id)

    const { count: reportsCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('memberid', params.id)

    const result = {
      ...member,
      schedules: schedules || [],
      reports: reports || [],
      _count: {
        schedules: schedulesCount || 0,
        reports: reportsCount || 0
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法取得成員資料' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, email, phone, role, active } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '姓名為必填' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('members')
      .select('id, email, role, active')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    }

    const { data: member, error } = await supabase
      .from('members')
      .update({
        name: name.trim(),
        email: email?.trim() || existing.email,
        phone: phone?.trim() || null,
        role: role || existing.role,
        active: active !== undefined ? active : existing.active,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(member)
  } catch (error) {
    console.error('PUT /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法更新成員' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '成員不存在' }, { status: 404 })
    }

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ message: '成員已刪除' })
  } catch (error) {
    console.error('DELETE /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法刪除成員' }, { status: 500 })
  }
}
