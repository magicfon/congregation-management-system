import { NextResponse } from 'next/server'
import { getPalette, getRecord, meetingList } from '@/lib/midweek-store'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.has('palette')) return NextResponse.json({ palette: await getPalette() }, { headers: { 'Cache-Control': 'no-store' } })
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ weeks: await meetingList(false) }, { headers: { 'Cache-Control': 'no-store' } })
    if (!/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ error: '找不到節目' }, { status: 404 })
    const record = await getRecord(id)
    if (!record?.published) return NextResponse.json({ error: '此週尚未發布' }, { status: 404 })
    return NextResponse.json({ meeting: record.published, publishedAt: record.publishedAt, versions: record.versions, versionDates: record.versionDates || {}, palette: await getPalette() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '節目暫時無法讀取' }, { status: 503 }) }
}
