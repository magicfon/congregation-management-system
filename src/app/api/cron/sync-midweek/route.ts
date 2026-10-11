import { NextResponse } from 'next/server'
import { syncMidweek } from '@/lib/midweek-sync'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try { return NextResponse.json(await syncMidweek()) }
  catch { return NextResponse.json({ error: '節目同步失敗' }, { status: 503 }) }
}
