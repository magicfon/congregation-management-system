import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { sameOrigin } from '@/lib/bulletin-announcements'
import { RosterError } from '@/lib/service-roster'
import { editServiceRoster, initializeServiceRoster, rosterSnapshot, RosterConflict } from '@/lib/service-roster-store'
export const dynamic = 'force-dynamic'
export async function GET() {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try { return NextResponse.json(await rosterSnapshot(prisma, true), { headers: { 'Cache-Control': 'no-store' } }) }
  catch { return NextResponse.json({ error: '資格資料暫時無法讀取' }, { status: 503 }) }
}
export async function POST(request: Request) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站安排' }, { status: 403 })
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RosterError('操作格式錯誤')
    if (body.action === 'initialize') await initializeServiceRoster(prisma)
    else {
      const result = await editServiceRoster(prisma, body)
      if (body.action === 'preview') return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json(await rosterSnapshot(prisma, true), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const conflict = error instanceof RosterConflict || (error as { code?: string })?.code === 'P2034'
    return NextResponse.json({ error: conflict ? '安排已更新，請重新載入再編輯' : error instanceof RosterError ? error.message : '操作失敗，請稍後重試' }, { status: conflict ? 409 : error instanceof RosterError || error instanceof SyntaxError ? 400 : 503 })
  }
}
