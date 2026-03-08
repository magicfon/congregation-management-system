import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// 獲取所有排班
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT 
        id, time_slot, group_name, leader, is_active, created_at, updated_at
      FROM schedules
      ORDER BY time_slot
    `
    
    return NextResponse.json({ schedules: rows })
  } catch (error) {
    console.error('Failed to fetch schedules:', error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

// 創建排班
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { time_slot, group_name, leader, is_active } = body
    
    const { rows } = await sql`
      INSERT INTO schedules (time_slot, group_name, leader, is_active)
      VALUES (${time_slot}, ${group_name}, ${leader}, ${is_active ?? true})
      RETURNING id
    `
    
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (error) {
    console.error('Failed to create schedule:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}

// 更新排班
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const body = await request.json()
    
    await sql`
      UPDATE schedules 
      SET time_slot = ${body.time_slot}, 
          group_name = ${body.group_name}, 
          leader = ${body.leader}, 
          is_active = ${body.is_active},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update schedule:', error)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}

// 刪除排班
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    await sql`DELETE FROM schedules WHERE id = ${id}`
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete schedule:', error)
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }
}
