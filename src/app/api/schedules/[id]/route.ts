import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: schedule, error } = await supabase
      .from('schedules')
      .select('*, areas(id, name), members(id, name)')
      .eq('id', params.id)
      .single()

    if (error || !schedule) {
      return NextResponse.json({ error: '排班不存在' }, { status: 404 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('GET /api/schedules/[id] error:', error)
    return NextResponse.json({ error: '無法取得排班資料' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, notes } = body

    const { data: existing } = await supabase
      .from('schedules')
      .select('id, status')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '排班不存在' }, { status: 404 })
    }

    const { data: schedule, error } = await supabase
      .from('schedules')
      .update({
        status: status || existing.status,
        notes: notes?.trim() || null,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('PUT /api/schedules/[id] error:', error)
    return NextResponse.json({ error: '無法更新排班' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: existing } = await supabase
      .from('schedules')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '排班不存在' }, { status: 404 })
    }

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ message: '排班已刪除' })
  } catch (error) {
    console.error('DELETE /api/schedules/[id] error:', error)
    return NextResponse.json({ error: '無法刪除排班' }, { status: 500 })
  }
}
