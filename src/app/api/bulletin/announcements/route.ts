import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { AnnouncementInputError, announcementDetails, readAnnouncementPdf, sameOrigin } from '@/lib/bulletin-announcements'

export const dynamic = 'force-dynamic'
const select = { id: true, title: true, size: true, createdAt: true }

export async function GET() {
  try {
    return NextResponse.json(await prisma.bulletinAnnouncement.findMany({ where: { removedAt: null }, select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }), { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '公告暫時無法讀取，請重試' }, { status: 503 }) }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站上傳公告' }, { status: 403 })
  try {
    const params = new URL(request.url).searchParams
    const details = announcementDetails(params.get('title'), params.get('filename'))
    const content = await readAnnouncementPdf(request)
    const announcement = await prisma.bulletinAnnouncement.create({ data: { ...details, content, size: content.length, uploadedBy: auth.user.id! }, select })
    return NextResponse.json(announcement, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof AnnouncementInputError ? error.message : '上傳失敗，請重試' }, { status: error instanceof AnnouncementInputError ? 400 : 503 })
  }
}
