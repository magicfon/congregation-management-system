import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { sameOrigin } from '@/lib/bulletin-announcements'

export const dynamic = 'force-dynamic'
type Context = { params: { id: string } }
export async function GET(_request: Request, { params }: Context) {
  try {
    const item = await prisma.bulletinAnnouncement.findFirst({ where: { id: params.id, removedAt: null }, select: { content: true, createdAt: true, id: true } })
    if (!item) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    return new Response(new Uint8Array(item.content), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="announcement.pdf"',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'X-Bulletin-Modified-At': item.createdAt.toISOString(), 'X-Bulletin-Version': item.id,
    } })
  } catch { return NextResponse.json({ error: '公告暫時無法讀取，請重試' }, { status: 503 }) }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站管理公告' }, { status: 403 })
  try {
    const result = await prisma.bulletinAnnouncement.updateMany({ where: { id: params.id, removedAt: null }, data: { removedAt: new Date() } })
    return new Response(null, { status: result.count ? 204 : 404, headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '下架失敗，請重試' }, { status: 503 }) }
}
