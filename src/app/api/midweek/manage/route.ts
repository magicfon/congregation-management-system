import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { sameOrigin } from '@/lib/bulletin-announcements'
import { prisma } from '@/lib/db'
import { MeetingConflict, MeetingError } from '@/lib/midweek'
import { editMeeting, getPalette, savePalette, getRecord, getSource, meetingList } from '@/lib/midweek-store'
import { syncMidweek, syncStatus } from '@/lib/midweek-sync'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const json = (value: unknown) => NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } })
export async function GET(request: Request) {
  const auth = await requireApiUser(['admin']); if ('response' in auth) return auth.response
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (id) return json({ source: await getSource(id), record: await getRecord(id), palette: await getPalette() })
    const [weeks, members, sync] = await Promise.all([meetingList(true), prisma.member.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), syncStatus()])
    return json({ weeks, members, sync })
  } catch { return NextResponse.json({ error: '節目暫時無法讀取' }, { status: 503 }) }
}
export async function POST(request: Request) {
  const auth = await requireApiUser(['admin']); if ('response' in auth) return auth.response
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站編排' }, { status: 403 })
  try {
    const text = await request.text()
    if (text.length > 100000) throw new MeetingError('節目內容太長')
    const body = JSON.parse(text)
    if (!body || typeof body !== 'object') throw new MeetingError('操作格式錯誤')
    if (body.action === 'sync') return json({ sync: await syncMidweek(true) })
    if (body.action === 'palette') return json({ palette: await savePalette(body.palette) })
    return json(await editMeeting(body.id, body.action, body.revision, body.meeting, { deleteLaterVersions: body.deleteLaterVersions }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof MeetingConflict ? '其他管理員已更新這週，請重新載入後再編輯' : error instanceof MeetingError ? error.message : '操作失敗，請稍後重試' }, { status: error instanceof MeetingConflict ? 409 : error instanceof MeetingError || error instanceof SyntaxError ? 400 : 503 })
  }
}
