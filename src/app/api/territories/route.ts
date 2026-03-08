import { NextRequest, from 'next/server'
import { db } from '@/lib/db'

// 獲取所有區域
export async function GET() {
  try {
    const territories = db.prepare(`
    SELECT 
      id, code, number, responsible_brother, split_date, last_completed_date, days_idle, status
    FROM territories
    ORDER BY code
  `).all()
    
    return NextResponse.json({ territories })
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
    
    const result = db.prepare(`
      INSERT INTO territories (code, number, responsible_brother, split_date, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, number, responsible_brother, split_date, status || 'active')
    
    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
  } catch (error) {
    console.error('Failed to create territory:', error)
    return NextResponse.json({ error: 'Failed to create territory' }, { status: 500 })
  }
}

// 更新區域
export async function PUT(request: NextRequest) {
  try {
    const { id } = request.query
    const body = await request.json()
    
    db.prepare(`
      UPDATE territories 
      SET code = ?, number = ?, responsible_brother = ?, split_date = ?, status = ?
      WHERE id = ?
    `).run(
      body.code, body.number, body.responsible_brother, body.split_date, body.status, id
    )
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update territory:', error)
    return NextResponse.json({ error: 'Failed to update territory' }, { status: 500 })
  }
}

// 刪除區域
export async function DELETE(request: NextRequest) {
  try {
    const { id } = request.query
    
    db.prepare('DELETE FROM territories WHERE id = ?').run(id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete territory:', error)
    return NextResponse.json({ error: 'Failed to delete territory' }, { status: 500 })
  }
}
