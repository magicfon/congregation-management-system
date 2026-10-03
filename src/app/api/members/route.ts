import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '../../../lib/db'
import { requireApiUser } from '../../../lib/api-auth'
import { memberFields, memberLineFields } from '../../../lib/member-fields'
import { isAreaDispatched } from '../../../lib/allocation'

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')
    const search = searchParams.get('search')?.trim()
    const isAdmin = auth.user.role === 'admin'

    const members = await prisma.member.findMany({
      where: {
        deletedAt: null,
        ...(search ? { OR: ['name', 'email', 'phone', ...(isAdmin ? ['lineuid', 'lineDisplayName'] : [])].map((field) => ({ [field]: { contains: search, mode: 'insensitive' as const } })) } : {}),
        ...(active !== null ? { active: active === 'true' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        ...(isAdmin ? memberLineFields : { ...memberFields, role: false }),
        assignedAreas: { select: { assignedMemberId: true, dispatchedAt: true, completedAt: true } },
        _count: { select: { schedules: true, reports: true } },
      },
    })

    return NextResponse.json(members.map(({ assignedAreas, ...member }) => ({
      ...member,
      heldMapCount: assignedAreas.filter(isAreaDispatched).length,
    })))
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
    if (body.showInDispatch !== undefined && typeof body.showInDispatch !== 'boolean') {
      return NextResponse.json({ error: '派發按鈕設定必須為布林值' }, { status: 400 })
    }
    const { name, email, password, phone } = body

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: '姓名、Email 和密碼為必填' }, { status: 400 })
    }

    const passwordHash = await hash(password.trim(), 10)

    const member = await prisma.member.create({
      select: memberLineFields,
      data: {
        name: name.trim(),
        email: email.trim(),
        password: passwordHash,
        phone: phone?.trim() || null,
        role: 'publisher',
        showInDispatch: body.showInDispatch ?? true,
        active: true,
      },
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('POST /api/members error:', error)
    return NextResponse.json({ error: '無法建立成員' }, { status: 500 })
  }
}
