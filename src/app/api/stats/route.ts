import { NextRequest, NextResponse } from 'next/server'
import { getStats, getReports } from '@/lib/db-memory'

// 獲取統計數據
export async function GET(request: NextRequest) {
  try {
    const stats = await getStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
