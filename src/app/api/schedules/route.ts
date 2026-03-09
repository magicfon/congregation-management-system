import { NextRequest, NextResponse } from 'next/server'
import { getSchedules, createSchedule } from '@/lib/db-memory'

// 獲取所有排班
export async function GET() {
  try {
    const schedules = await getSchedules()
    return NextResponse.json({ schedules })
  } catch (error) {
    console.error('Failed to fetch schedules:', error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

// 創建排班
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schedule = await createSchedule(body)
    return NextResponse.json({ id: schedule.id }, { status: 201 })
  } catch (error) {
    console.error('Failed to create schedule:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}
