import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db'
import { requireApiUser } from '../../../../../lib/api-auth'
import { readValues, DEFAULT_SHEET_ID } from '../../../../../lib/google-sheets'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    const area = await prisma.area.findUnique({ where: { id: params.id }, select: {
      id: true, name: true, sheetNo: true, dispatchEnabled: true,
      reports: { select: { id: true, content: true, status: true, submittedAt: true, member: { select: { name: true } } }, orderBy: { submittedAt: 'desc' }, take: 100 },
      _count: { select: { reports: true } },
    } })
    if (!area) return NextResponse.json({ error: '地圖不存在' }, { status: 404 })
    let sheetError: string | null = null
    let formReports: { row: number; submittedAt: string; memberName: string; completedDate: string }[] = []
    if (area.sheetNo !== null) {
      try {
        const rows = await readValues(DEFAULT_SHEET_ID, '傳道區域回報!A2:G')
        formReports = rows.flatMap((row, index) => Number(row[3]) === area.sheetNo ? [{ row: index + 2, submittedAt: row[0] || '', memberName: row[1] || '', completedDate: row[5] || '' }] : []).reverse()
      } catch { sheetError = 'Google 表單歷史暫時無法讀取，請重試；下列系統紀錄不是完整表單歷史。' }
    }
    return NextResponse.json({ ...area, formReports, sheetError }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '無法讀取地圖屬性與紀錄' }, { status: 503 }) }
}
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (typeof body?.dispatchEnabled !== 'boolean' || typeof body?.expectedEnabled !== 'boolean') return NextResponse.json({ error: '分發設定格式錯誤' }, { status: 400 })
  try {
    const updated = await prisma.area.updateMany({ where: { id: params.id, dispatchEnabled: body.expectedEnabled }, data: { dispatchEnabled: body.dispatchEnabled } })
    if (updated.count !== 1) return NextResponse.json({ error: '地圖已被修改或不存在，請重新載入後再試' }, { status: 409 })
    return NextResponse.json({ dispatchEnabled: body.dispatchEnabled })
  } catch { return NextResponse.json({ error: '儲存失敗，請重新載入確認狀態' }, { status: 500 }) }
}
