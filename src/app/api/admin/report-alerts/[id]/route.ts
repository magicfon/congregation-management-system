import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireApiUser } from '../../../../../lib/api-auth'
import { prisma } from '../../../../../lib/db'
import { pushAreaCD, updateValues, updateSnapshot, DEFAULT_SHEET_ID } from '../../../../../lib/google-sheets'
import { resolveReportAlert, AlertAction } from '../../../../../lib/report-alerts'
import { TerritoryReportError } from '../../../../../lib/territory-report'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/admin/report-alerts/[id] — 管理員處理回報待確認（ADR-0100）
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || !['return', 'keep', 'restore', 'use_sheet'].includes(body.action)) return NextResponse.json({ error: '操作無效' }, { status: 400 })
  try {
    const outcome = await resolveReportAlert(prisma, params.id, body.action as AlertAction, auth.user.name || auth.user.id || '管理員')
    if (outcome.stale) return NextResponse.json({ ok: true, stale: true, message: '地圖狀態已變更，這則提醒已自動結案。' })
    let warning = ''
    if (outcome.sheet) {
      const { sheetNo, member, dispatchedAt, keepDate } = outcome.sheet
      try {
        if (keepDate) await updateValues(DEFAULT_SHEET_ID, `區域狀態!C${sheetNo + 1}:C${sheetNo + 1}`, [['']])
        else await pushAreaCD(DEFAULT_SHEET_ID, sheetNo, member, dispatchedAt)
        await updateSnapshot([{ sheetNo, member, date: dispatchedAt, keepDate }])
      } catch (error) {
        console.error('report alert sheet push failed (cron 會補推):', error)
        warning = '系統已更新，區域狀態表稍後會自動同步。'
      }
    }
    return NextResponse.json({ ok: true, warning })
  } catch (error) {
    if (error instanceof TerritoryReportError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return NextResponse.json({ error: '其他人同時更新這張地圖，請重新整理後再試' }, { status: 409 })
    console.error('POST /api/admin/report-alerts error:', error)
    return NextResponse.json({ error: '處理失敗，請稍後再試' }, { status: 503 })
  }
}
