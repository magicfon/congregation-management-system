import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '../../../../lib/api-auth'
import { prisma } from '../../../../lib/db'
import { lineBotReady } from '../../../../lib/line-bot-client'
import { drainLineNotifications } from '../../../../lib/line-notifications'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET() {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    const [pending, failed] = await Promise.all(['pending','failed'].map(status=>prisma.lineNotification.count({ where: { status } })))
    return NextResponse.json({ enabled: lineBotReady(), pending, failed, configured: { secret: !!process.env.LINE_BOT_CHANNEL_SECRET, token: !!process.env.LINE_BOT_ACCESS_TOKEN, sameProvider: process.env.LINE_BOT_SAME_PROVIDER === 'true', enabled: process.env.LINE_BOT_ENABLED === 'true' } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '無法讀取 LINE 通知狀態' }, { status: 503 }) }
}
export async function POST(request: NextRequest) {
  const cron = process.env.CRON_SECRET && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!cron) {
    const auth = await requireApiUser(['admin'])
    if ('response' in auth) return auth.response
  }
  try { return NextResponse.json(await drainLineNotifications(prisma)) }
  catch { return NextResponse.json({ error: '通知重試暫時失敗，原排程與回報不受影響' }, { status: 503 }) }
}
