import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { buildWeekReminder, PUBLIC_TALK_REMINDER_KEY, readReminderSettings } from '@/lib/public-talk-reminder'
import { reminderMemberOptions, saveReminderRecipients } from '@/lib/reminder-recipients'
export const dynamic = 'force-dynamic'

async function state() {
  const [settings, members] = await Promise.all([readReminderSettings(prisma), reminderMemberOptions(prisma)])
  let preview: { text: string | null; monday: string; sunday: string } | { error: string }
  try { const week = await buildWeekReminder(); preview = { text: week.text, monday: week.monday, sunday: week.sunday } }
  catch { preview = { error: '公眾演講秩序表暫時讀不到，稍後再試。' } }
  return { enabled: settings.enabled, memberIds: settings.memberIds, lastRun: settings.lastRun ?? null, preview, members }
}

export async function GET() {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try { return NextResponse.json(await state(), { headers: { 'Cache-Control': 'no-store' } }) }
  catch { return NextResponse.json({ error: '提醒設定暫時無法讀取' }, { status: 503 }) }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  try {
    if (!await saveReminderRecipients(prisma, PUBLIC_TALK_REMINDER_KEY, body)) return NextResponse.json({ error: '資料格式錯誤' }, { status: 400 })
    return NextResponse.json(await state())
  } catch { return NextResponse.json({ error: '儲存失敗，請再試一次' }, { status: 503 }) }
}
