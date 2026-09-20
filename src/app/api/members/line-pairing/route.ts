import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireApiUser } from '../../../../lib/api-auth'
import { prisma } from '../../../../lib/db'
import { LinePairingError, pairLineMember } from '../../../../lib/line-pairing'

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || !['sourceId', 'targetId', 'expectedUid'].every((key) => typeof body[key] === 'string' && body[key].trim())) {
    return NextResponse.json({ error: '缺少來源、目標成員或 UID' }, { status: 400 })
  }
  try {
    return NextResponse.json(await pairLineMember(prisma, body.sourceId, body.targetId, body.expectedUid))
  } catch (error) {
    if (error instanceof LinePairingError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      return NextResponse.json({ error: '綁定同時被修改，請重新整理後重試' }, { status: 409 })
    }
    console.error('LINE pairing failed:', error)
    return NextResponse.json({ error: '配對失敗，請稍後重試' }, { status: 500 })
  }
}
