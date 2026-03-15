import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { supabase } from '../../../../lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const member = await supabase.from("members").findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        _count: { select: { schedules: true, reports: true } },
      },
    })

    if (!member) return NextResponse.json({ error: '成員不存在' }, { status: 404 })

    return NextResponse.json(member)
  } catch (error) {
    console.error('GET /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法取得成員資料' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, email, password, phone, role, active } = body

    if (!name?.trim()) return NextResponse.json({ error: '姓名為必填' }, { status: 400 })
    if (!email?.trim()) return NextResponse.json({ error: '電子郵件為必填' }, { status: 400 })

    const existing = await supabase.from("members").findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: '成員不存在' }, { status: 404 })

    const emailConflict = await supabase.from("members").findFirst({
      where: { email: email.trim(), NOT: { id: params.id } },
    })
    if (emailConflict) return NextResponse.json({ error: '此電子郵件已被使用' }, { status: 409 })

    const updateData: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      role: role ?? existing.role,
      active: active ?? existing.active,
    }

    if (password && password.length >= 6) {
      updateData.password = await hash(password, 12)
    }

    const member = await supabase.from("members").update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
      },
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('PUT /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法更新成員' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await supabase.from("members").findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: '成員不存在' }, { status: 404 })

    await supabase.from("members").delete({ where: { id: params.id } })

    return NextResponse.json({ message: '成員已刪除' })
  } catch (error) {
    console.error('DELETE /api/members/[id] error:', error)
    return NextResponse.json({ error: '無法刪除成員' }, { status: 500 })
  }
}
