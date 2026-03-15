import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let query = supabase
      .from('areas')
      .select('*')

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: areas, error } = await query.order('createdat', { ascending: false })

    if (error) throw error

    // Get counts for each area
    const areasWithCounts = await Promise.all(
      (areas || []).map(async (area) => {
        const [schedulesResult, reportsResult] = await Promise.all([
          supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('areaid', area.id),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('areaid', area.id)
        ])

        return {
          ...area,
          _count: {
            schedules: schedulesResult.count || 0,
            reports: reportsResult.count || 0
          }
        }
      })
    )

    return NextResponse.json(areasWithCounts)
  } catch (error) {
    console.error('GET /api/areas error:', error)
    return NextResponse.json({ error: '無法取得區域列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, assignedTo } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '區域名稱為必填' }, { status: 400 })
    }

    const { data: area, error } = await supabase
      .from('areas')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        assignedto: assignedTo?.trim() || null,
        lastactivityat: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(area, { status: 201 })
  } catch (error) {
    console.error('POST /api/areas error:', error)
    return NextResponse.json({ error: '無法建立區域' }, { status: 500 })
  }
}
