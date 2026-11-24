import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { ADMIN_TASK_REMINDER_KEY, buildAdminTaskReminder, readAdminTaskReminderSettings } from '@/lib/admin-task-reminder'
import { reminderMemberOptions, saveReminderRecipients } from '@/lib/reminder-recipients'
export const dynamic = 'force-dynamic'

// 管理工具「管理待辦每日提醒」卡片的設定與預覽（ADR-0148）
async function state() {
  const [settings, members] = await Promise.all([readAdminTaskReminderSettings(prisma), reminderMemberOptions(prisma)])
  let preview: { text: string | null } | { error: string }
  try { preview = { text: (await buildAdminTaskReminder(prisma)).text } }
  catch { preview = { error: '管理待辦暫時讀不到，稍後再試。' } }
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
    if (!await saveReminderRecipients(prisma, ADMIN_TASK_REMINDER_KEY, body)) return NextResponse.json({ error: '資料格式錯誤' }, { status: 400 })
    return NextResponse.json(await state())
  } catch { return NextResponse.json({ error: '儲存失敗，請再試一次' }, { status: 503 }) }
}
