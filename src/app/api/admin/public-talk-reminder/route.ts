import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { buildWeekReminder, readReminderSettings, writeReminderSettings } from '@/lib/public-talk-reminder'
export const dynamic = 'force-dynamic'

async function state() {
  const [settings, members] = await Promise.all([
    readReminderSettings(prisma),
    prisma.member.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true, lineuid: true, lineNotificationsEnabled: true }, orderBy: { name: 'asc' } }),
  ])
  let preview: { text: string | null; monday: string; sunday: string } | { error: string }
  try { const week = await buildWeekReminder(); preview = { text: week.text, monday: week.monday, sunday: week.sunday } }
  catch { preview = { error: '公眾演講秩序表暫時讀不到，稍後再試。' } }
  return {
    enabled: settings.enabled, memberIds: settings.memberIds, lastRun: settings.lastRun ?? null, preview,
    members: members.map(m => ({ id: m.id, name: m.name, linked: !!m.lineuid, notifications: m.lineNotificationsEnabled })),
  }
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
  if (!body || typeof body.enabled !== 'boolean' || !Array.isArray(body.memberIds) || body.memberIds.some((id: unknown) => typeof id !== 'string') || body.memberIds.length > 50) return NextResponse.json({ error: '資料格式錯誤' }, { status: 400 })
  try {
    const valid = await prisma.member.findMany({ where: { id: { in: body.memberIds }, deletedAt: null }, select: { id: true } })
    const ids = new Set(valid.map(m => m.id))
    const current = await readReminderSettings(prisma)
    await writeReminderSettings(prisma, { ...current, enabled: body.enabled, memberIds: (body.memberIds as string[]).filter((id, i, all) => ids.has(id) && all.indexOf(id) === i) })
    return NextResponse.json(await state())
  } catch { return NextResponse.json({ error: '儲存失敗，請再試一次' }, { status: 503 }) }
}
