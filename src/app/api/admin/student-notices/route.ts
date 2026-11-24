import { NextResponse } from 'next/server'
import { requireApiUser } from '../../../../lib/api-auth'
import { prisma } from '../../../../lib/db'
import { taipeiDate } from '../../../../lib/google-sheets'
import { studentNoticeOverview } from '../../../../lib/student-notice'

export const dynamic = 'force-dynamic'
// GET /api/admin/student-notices — 今天起已發布各週的學生通知單內容與確認狀態（ADR-0146）
export async function GET() {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    return NextResponse.json({ weeks: await studentNoticeOverview(prisma, taipeiDate(new Date())) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '通知單資料暫時無法讀取，請重新整理。' }, { status: 503 })
  }
}
