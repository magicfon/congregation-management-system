import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireApiUser } from '../../../../lib/api-auth'
import { prisma } from '../../../../lib/db'
import { linkPendingLineIdentity } from '../../../../lib/pending-line-identities'
import { LinePairingError } from '../../../../lib/line-pairing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    return NextResponse.json(await prisma.pendingLineIdentity.findMany({ orderBy: { createdAt: 'asc' } }), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '無法載入待確認名單，請稍後重試' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (typeof body?.uid !== 'string' || !/^U[0-9a-f]{32}$/i.test(body.uid) || typeof body?.targetId !== 'string' || !body.targetId.trim()) {
    return NextResponse.json({ error: '請選擇待確認帳號與目標成員' }, { status: 400 })
  }
  try {
    return NextResponse.json(await linkPendingLineIdentity(prisma, body.uid, body.targetId))
  } catch (error) {
    if (error instanceof LinePairingError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034', 'P2025'].includes(error.code)) {
      return NextResponse.json({ error: '綁定已被修改，請重新整理後重試' }, { status: 409 })
    }
    return NextResponse.json({ error: '無法確認連結結果，請重新整理名單' }, { status: 503 })
  }
}
