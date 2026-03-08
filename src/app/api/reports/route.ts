import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// 獲取所有回報
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const territoryId = searchParams.get('territory_id')
    const publisher = searchParams.get('publisher')
    const limit = searchParams.get('limit') || '50'
    
    let query = `
      SELECT 
        r.id, r.timestamp, r.publisher_name, r.time_slot, 
        r.territory_id, r.start_date, r.notes,
        t.code as territory_code
      FROM reports r
      LEFT JOIN territories t ON r.territory_id = t.id
    `
    
    const conditions = []
    const params: any[] = []
    
    if (territoryId) {
      params.push(territoryId)
      conditions.push(`r.territory_id = $${params.length}`)
    }
    
    if (publisher) {
      params.push(publisher)
      conditions.push(`r.publisher_name = $${params.length}`)
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
    
    query += ` ORDER BY r.timestamp DESC LIMIT ${limit}`
    
    const { rows } = await sql.query(query, params)
    
    return NextResponse.json({ reports: rows })
  } catch (error) {
    console.error('Failed to fetch reports:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

// 創建回報
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { publisher_name, time_slot, territory_id, start_date, notes } = body
    
    const { rows } = await sql`
      INSERT INTO reports (timestamp, publisher_name, time_slot, territory_id, start_date, notes)
      VALUES (CURRENT_TIMESTAMP, ${publisher_name}, ${time_slot}, ${territory_id}, ${start_date}, ${notes})
      RETURNING id
    `
    
    // 更新區域的最後完成日期和閒置天數
    if (territory_id) {
      await sql`
        UPDATE territories 
        SET last_completed_date = CURRENT_DATE,
            days_idle = 0,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${territory_id}
      `
    }
    
    return NextResponse.json({ id: rows[0].id, success: true }, { status: 201 })
  } catch (error) {
    console.error('Failed to create report:', error)
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}

// 刪除回報
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    await sql`DELETE FROM reports WHERE id = ${id}`
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete report:', error)
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
  }
}
