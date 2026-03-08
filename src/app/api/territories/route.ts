import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// 獲取所有區域
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT 
        id, code, number, responsible_brother, split_date, last_completed_date, days_idle, status
      FROM territories
      ORDER BY code
    `
    
    return NextResponse.json({ territories: rows })
  } catch (error) {
    console.error('Failed to fetch territories:', error)
    return NextResponse.json({ error: 'Failed to fetch territories' }, { status: 500 })
  }
}

// 創建區域
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, number, responsible_brother, split_date, status } = body
    
    const { rows } = await sql`
      INSERT INTO territories (code, number, responsible_brother, split_date, status)
      VALUES (${code}, ${number}, ${responsible_brother}, ${split_date}, ${status || 'active'})
      RETURNING id
    `
    
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (error) {
    console.error('Failed to create territory:', error)
    return NextResponse.json({ error: 'Failed to create territory' }, { status: 500 })
  }
}

// 更新區域
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const body = await request.json()
    
    await sql`
      UPDATE territories 
      SET code = ${body.code}, 
          number = ${body.number}, 
          responsible_brother = ${body.responsible_brother}, 
          split_date = ${body.split_date}, 
          status = ${body.status},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update territory:', error)
    return NextResponse.json({ error: 'Failed to update territory' }, { status: 500 })
  }
}

// 刪除區域
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    await sql`DELETE FROM territories WHERE id = ${id}`
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete territory:', error)
    return NextResponse.json({ error: 'Failed to delete territory' }, { status: 500 })
  }
}
