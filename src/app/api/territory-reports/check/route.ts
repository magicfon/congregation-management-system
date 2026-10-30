import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '../../../../lib/db'
import { authOptions } from '../../../../lib/auth'
import { taipeiDate } from '../../../../lib/google-sheets'
import { checkTerritoryReport, resolveReportActor, TerritoryReportError, MAX_REPORT_AREAS } from '../../../../lib/territory-report'

export const dynamic = 'force-dynamic'
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

// POST /api/territory-reports/check — 確認畫面用：逐區判斷會交回、交管理員確認或不能送出（ADR-0100）
// 只回處理方式與理由，不含持有人姓名；送出時伺服器會再判斷一次
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string } | undefined
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const sheetNos = [...new Set((Array.isArray(body.sheetNos) ? body.sheetNos : []).map(Number))]
    if (!sheetNos.length || sheetNos.length > MAX_REPORT_AREAS || sheetNos.some(no => !Number.isInteger(no) || no < 1 || no > 213)) return respond({ error: '區域號碼無效' }, 400)
    const endDate = typeof body.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.endDate) ? body.endDate : taipeiDate(new Date())
    const name = !user?.id && typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 30) : ''
    const actor = await resolveReportActor(prisma, user?.id ?? null, user?.role === 'admin', name)
    return respond({ areas: await checkTerritoryReport(prisma, actor, sheetNos, endDate) })
  } catch (error) {
    if (error instanceof TerritoryReportError) return respond({ error: error.message }, error.status)
    console.error('POST /api/territory-reports/check error:', error)
    return respond({ error: '無法檢查區域，請稍後再試' }, 503)
  }
}
