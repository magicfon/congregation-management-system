import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const active = searchParams.get('active')

    let query = supabase
      .from('members')
      .select('*')

    if (role) {
      query = query.eq('role', role)
    }

    if (active !== null) {
      query = query.eq('active', active === 'true')
    }

    const { data: members, error } = await query.order('createdat', { ascending: false })

    if (error) throw error

    // Get counts for each member
    const membersWithCounts = await Promise.all(
      (members || []).map(async (member) => {
        const [schedulesResult, reportsResult] = await Promise.all([
          supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('memberid', member.id),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('memberid', member.id)
        ])

        return {
          ...member,
          _count: {
            schedules: schedulesResult.count || 0,
            reports: reportsResult.count || 0
          }
        }
      })
    )

    return NextResponse.json(membersWithCounts)
  } catch (error) {
    console.error('GET /api/members error:', error)
    return NextResponse.json({ error: '無法取得成員列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, phone, role } = body

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: '姓名、Email 和密碼為必填' }, { status: 400 })
    }

    const { data: member, error } = await supabase
      .from('members')
      .insert({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        phone: phone?.trim() || null,
        role: role || 'publisher',
        active: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('POST /api/members error:', error)
    return NextResponse.json({ error: '無法建立成員' }, { status: 500 })
  }
}
