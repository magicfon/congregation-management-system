import { NextRequest, NextResponse } from 'next/server'
import { getTerritories, createTerritory, updateTerritory, deleteTerritory } from '@/lib/db-memory'

// 獲取所有區域
export async function GET() {
  try {
    const territories = await getTerritories()
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
    const territory = await createTerritory(body)
    return NextResponse.json({ id: territory.id }, { status: 201 })
  } catch (error) {
    console.error('Failed to create territory:', error)
    return NextResponse.json({ error: 'Failed to create territory' }, { status: 500 })
  }
}

// 更新區域
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '0')
    const body = await request.json()
    
    const territory = await updateTerritory(id, body)
    if (!territory) {
      return NextResponse.json({ error: 'Territory not found' }, { status: 404 })
    }
    
    return NextResponse.json({ territory })
  } catch (error) {
    console.error('Failed to update territory:', error)
    return NextResponse.json({ error: 'Failed to update territory' }, { status: 500 })
  }
}

// 刪除區域
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '0')
    
    const success = await deleteTerritory(id)
    if (!success) {
      return NextResponse.json({ error: 'Territory not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete territory:', error)
    return NextResponse.json({ error: 'Failed to delete territory' }, { status: 500 })
  }
}
