import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: areas, error } = await supabase
      .from('areas')
      .select('id, name, lastactivityat, assignedto')
      .order('lastactivityat', { ascending: true })

    if (error) throw error

    const now = Date.now()
    const oneDayMs = 1000 * 60 * 60 * 24

    const idleStats = (areas || []).map(area => {
      const lastActivity = area.lastactivityat ? new Date(area.lastactivityat).getTime() : 0
      const idleDays = Math.floor((now - lastActivity) / oneDayMs)
      
      let status: 'green' | 'yellow' | 'orange' | 'red'
      if (idleDays < 7) {
        status = 'green'
      } else if (idleDays < 30) {
        status = 'yellow'
      } else if (idleDays < 90) {
        status = 'orange'
      } else {
        status = 'red'
      }

      return {
        areaId: area.id,
        areaName: area.name,
        idleDays,
        status,
        assignedTo: area.assignedto || null,
        lastActivityAt: area.lastactivityat
      }
    })

    return NextResponse.json(idleStats)
  } catch (error) {
    console.error('GET /api/areas/idle-stats error:', error)
    return NextResponse.json({ error: '無法取得區域閒置統計' }, { status: 500 })
  }
}
