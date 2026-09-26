import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '../../../lib/api-auth'
import { prisma } from '../../../lib/db'
import { submitMapRequests, requestError } from '../../../lib/map-requests'
export const dynamic = 'force-dynamic'
export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const isAdmin = auth.user.role === 'admin'
    const requests = await prisma.mapRequest.findMany({ where: isAdmin ? {} : { memberId: auth.user.id! }, include: { member: { select: { name: true } }, area: { select: { name: true, mapId: true, sheetNo: true, mapAreaId: true } } }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ isAdmin, requests, pendingAreaIds: requests.filter(r => r.memberId === auth.user.id && r.status === 'pending').map(r => r.areaId) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '申請清單暫時無法讀取' }, { status: 503 }) }
}
export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.areaIds) || body.areaIds.length < 1 || body.areaIds.length > 5 || body.areaIds.some((id: unknown) => typeof id !== 'string' || !id.trim()) || new Set(body.areaIds).size !== body.areaIds.length) return NextResponse.json({ error: '請選擇 1–5 張不同的地圖' }, { status: 400 })
  try { return NextResponse.json(await submitMapRequests(prisma, auth.user.id!, body.areaIds), { status: 201 }) }
  catch (error) { const message = requestError(error); return NextResponse.json({ error: message || '送出失敗，請先查看申請清單確認結果再試' }, { status: message ? 409 : 500 }) }
}
