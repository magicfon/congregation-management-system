import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// 獲取統計數據
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'overview'
    
    if (type === 'overview') {
      // 總覽統計
      const [territoryStats, reportStats, scheduleStats, idleTerritories] = await Promise.all([
        // 區域統計
        sql`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'active') as active,
            COUNT(*) FILTER (WHERE status = 'idle') as idle,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            AVG(days_idle)::numeric(10,1) as avg_days_idle
          FROM territories
        `,
        // 回報統計
        sql`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE timestamp > CURRENT_DATE - INTERVAL '7 days') as this_week,
            COUNT(*) FILTER (WHERE timestamp > CURRENT_DATE - INTERVAL '30 days') as this_month
          FROM reports
        `,
        // 排班統計
        sql`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_active = true) as active
          FROM schedules
        `,
        // 閒置區域
        sql`
          SELECT code, responsible_brother, days_idle
          FROM territories
          WHERE status = 'idle' OR days_idle > 30
          ORDER BY days_idle DESC
          LIMIT 10
        `
      ])
      
      return NextResponse.json({
        territories: territoryStats.rows[0],
        reports: reportStats.rows[0],
        schedules: scheduleStats.rows[0],
        idleTerritories: idleTerritories.rows
      })
    }
    
    if (type === 'publishers') {
      // 傳道員統計
      const { rows } = await sql`
        SELECT 
          publisher_name,
          COUNT(*) as total_reports,
          COUNT(DISTINCT territory_id) as territories_worked,
          MIN(timestamp)::date as first_report,
          MAX(timestamp)::date as last_report
        FROM reports
        GROUP BY publisher_name
        ORDER BY total_reports DESC
      `
      
      return NextResponse.json({ publishers: rows })
    }
    
    if (type === 'idle') {
      // 閒置區域詳情
      const { rows } = await sql`
        SELECT 
          id, code, responsible_brother, days_idle, 
          last_completed_date, status
        FROM territories
        WHERE days_idle > 30 OR status = 'idle'
        ORDER BY days_idle DESC
      `
      
      return NextResponse.json({ idleTerritories: rows })
    }
    
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
