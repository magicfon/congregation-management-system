import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const areaId = searchParams.get('areaId')
    const memberId = searchParams.get('memberId')

    let query = supabase
      .from('schedules')
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

    const { data: schedules, error } = await query.order('date', { ascending: false })

    if (error) throw error

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('GET /api/schedules error:', error)
    return NextResponse.json({ error: '無法取得排班列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { areaId, memberId, date, timeSlot, status, notes } = body

    if (!areaId?.trim() || !memberId?.trim() || !date) {
      return NextResponse.json({ error: '區域、成員和日期為必填' }, { status: 400 })
    }

    const { data: schedule, error } = await supabase
      .from('schedules')
      .insert({
        areaid: areaId.trim(),
        memberid: memberId.trim(),
        date: new Date(date).toISOString(),
        timeslot: timeSlot || 'morning',
        status: status || 'scheduled',
        notes: notes?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('POST /api/schedules error:', error)
    return NextResponse.json({ error: '無法建立排班' }, { status: 500 })
  }
}
