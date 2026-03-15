import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

export async function GET() {
  try {
    // Get all counts
    const [
      { count: areaCount },
      { count: memberCount },
      { count: scheduleCount },
      { count: reportCount },
      { data: recentAreas }
    ] = await Promise.all([
      supabase.from('areas').select('id', { count: 'exact', head: true }),
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('areas').select('id, name, lastactivityat, assignedto').order('lastactivityat', { ascending: true }).limit(5)
    ])

    return NextResponse.json({
      areaCount: areaCount || 0,
      memberCount: memberCount || 0,
      scheduleCount: scheduleCount || 0,
      reportCount: reportCount || 0,
      recentAreas: recentAreas || []
    })
  } catch (error) {
    console.error('GET /api/statistics error:', error)
    return NextResponse.json({ error: '無法取得統計資料' }, { status: 500 })
  }
}
