import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '../../../lib/db'
import { requireApiUser } from '../../../lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')

    const members = await prisma.member.findMany({
      where: {
        ...(active !== null ? { active: active === 'true' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { schedules: true, reports: true } },
      },
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('GET /api/members error:', error)
    return NextResponse.json({ error: '無法取得成員列表' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response

  try {
    const body = await request.json()
    const { name, email, password, phone } = body

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: '姓名、Email 和密碼為必填' }, { status: 400 })
    }

    const passwordHash = await hash(password.trim(), 10)

    const member = await prisma.member.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        password: passwordHash,
        phone: phone?.trim() || null,
        role: 'publisher',
        active: true,
      },
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('POST /api/members error:', error)
    return NextResponse.json({ error: '無法建立成員' }, { status: 500 })
  }
}
