import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const activeParam = searchParams.get('active')

    const members = await prisma.member.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
        ...(role ? { role } : {}),
        ...(activeParam === 'false' ? { active: false } : { active: true }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        _count: {
          select: { schedules: true, reports: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('GET /api/members error:', error)
    return NextResponse.json({ error: '無法取得成員列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, phone, role } = body

    if (!name?.trim()) return NextResponse.json({ error: '姓名為必填' }, { status: 400 })
    if (!email?.trim()) return NextResponse.json({ error: '電子郵件為必填' }, { status: 400 })
    if (!password || password.length < 6) return NextResponse.json({ error: '密碼至少需要 6 個字元' }, { status: 400 })
    if (!role) return NextResponse.json({ error: '角色為必填' }, { status: 400 })

    const existing = await prisma.member.findUnique({ where: { email: email.trim() } })
    if (existing) return NextResponse.json({ error: '此電子郵件已被使用' }, { status: 409 })

    const hashedPassword = await hash(password, 12)

    const member = await prisma.member.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        password: hashedPassword,
        phone: phone?.trim() || null,
        role,
      },
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

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('POST /api/members error:', error)
    return NextResponse.json({ error: '無法建立成員' }, { status: 500 })
  }
}
