import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
export const dynamic = 'force-dynamic'
export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const member = await prisma.member.findUnique({ where: { id: auth.user.id! }, select: { active: true, lineuid: true, lineNotificationsEnabled: true } })
    if (!member?.active) return NextResponse.json({ error: '帳號未啟用' }, { status: 403 })
    return NextResponse.json({ enabled: member.lineNotificationsEnabled, linked: !!member.lineuid }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '無法讀取通知偏好' }, { status: 503 }) }
}
export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const body = await request.json()
    if (typeof body?.enabled !== 'boolean') return NextResponse.json({ error: '通知設定格式無效' }, { status: 400 })
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.member.updateMany({ where: { id: auth.user.id!, active: true }, data: { lineNotificationsEnabled: body.enabled } })
      if (result.count && !body.enabled) await tx.lineNotification.updateMany({ where: { memberId: auth.user.id!, status: 'pending' }, data: { status: 'cancelled', lastError: 'notifications_disabled' } })
      return result.count
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    if (!updated) return NextResponse.json({ error: '帳號未啟用' }, { status: 403 })
    return NextResponse.json({ enabled: body.enabled })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: '通知設定格式無效' }, { status: 400 })
    return NextResponse.json({ error: '設定未確認，請重新整理後再試' }, { status: 503 })
  }
}
