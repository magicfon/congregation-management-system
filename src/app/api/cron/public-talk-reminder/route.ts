import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendPublicTalkReminders } from '@/lib/public-talk-reminder'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
// Vercel Cron 每週一 01:00 UTC（台北 09:00）。ADR-0145
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try { return NextResponse.json(await sendPublicTalkReminders(prisma)) }
  catch (error) {
    console.error('public talk reminder failed:', error)
    return NextResponse.json({ error: '公眾演講提醒失敗' }, { status: 503 })
  }
}
