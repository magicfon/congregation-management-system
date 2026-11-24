import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendAdminTaskReminders } from '@/lib/admin-task-reminder'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
// Vercel Cron 每天 12:00 UTC（台北 20:00）。ADR-0148
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try { return NextResponse.json(await sendAdminTaskReminders(prisma)) }
  catch (error) {
    console.error('admin task reminder failed:', error)
    return NextResponse.json({ error: '管理待辦提醒失敗' }, { status: 503 })
  }
}
