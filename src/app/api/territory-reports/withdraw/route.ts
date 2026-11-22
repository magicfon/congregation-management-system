import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../lib/db'
import { requireApiUser } from '../../../../lib/api-auth'
import { batchUpdate, deleteSheetRow, readSnapshot, readValues, taipeiDate, updateSnapshot, DEFAULT_SHEET_ID } from '../../../../lib/google-sheets'
import { TerritoryReportError } from '../../../../lib/territory-report'
import { latestReports, parseReportRows, reportKey, withdrawReport } from '../../../../lib/report-withdraw'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
const TAB = '傳道區域回報'

// POST /api/territory-reports/withdraw — 管理員退回某區最近一筆回報，還原它造成的效果（ADR-0140）
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if ('response' in auth) return auth.response
  try {
    const body = await request.json()
    const key = typeof body?.key === 'string' ? body.key : ''
    const row = Number(key.split('|')[0])
    if (!Number.isInteger(row) || row < 2) return respond({ error: '資料格式無效' }, 400)
    const snapshot = await readSnapshot()
    if (snapshot.size !== 213 || Array.from({ length: 213 }, (_, i) => i + 1).some(no => !snapshot.has(no))) return respond({ error: '同步快照不完整，暫時不能退回，請稍後再試' }, 503)
    const rows = parseReportRows(await readValues(DEFAULT_SHEET_ID, `${TAB}!A2:G`))
    const target = rows.find(r => r.row === row)
    if (!target || reportKey(target) !== key) return respond({ error: '回報表剛有變動，請重新整理後再試' }, 409)
    if (latestReports(rows).get(target.sheetNo)?.row !== row) return respond({ error: '這區已有更新的回報，請重新整理後再試' }, 409)
    const result = await withdrawReport(prisma, target, rows, auth.user.name || '管理員', async () => {
      // 刪列前再確認一次那一列沒被動過
      const again = parseReportRows(await readValues(DEFAULT_SHEET_ID, `${TAB}!A${row}:G${row}`))[0]
      const cells = again ? { ...again, row } : null
      if (!cells || reportKey(cells) !== key) throw new TerritoryReportError('回報表剛有變動，請重新整理後再試', 409)
      await deleteSheetRow(DEFAULT_SHEET_ID, TAB, row)
    })
    let warning = ''
    if (result.sheet) {
      try {
        await batchUpdate(DEFAULT_SHEET_ID, [{ range: `區域狀態!C${result.sheetNo + 1}:D${result.sheetNo + 1}`, values: [[result.sheet.member, taipeiDate(result.sheet.dispatchedAt)]] }])
        await updateSnapshot([{ sheetNo: result.sheetNo, member: result.sheet.member, date: result.sheet.dispatchedAt }])
      } catch { warning = '回報已退回，區域狀態表稍後會自動同步。' }
    }
    return respond({ ok: true, sheetNo: result.sheetNo, done: result.done, warning })
  } catch (error) {
    if (error instanceof TerritoryReportError) return respond({ error: error.message }, error.status)
    if (error instanceof SyntaxError) return respond({ error: '資料格式無效' }, 400)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return respond({ error: '其他人同時更新這張地圖，請重新再試' }, 409)
    console.error('POST /api/territory-reports/withdraw error:', error)
    return respond({ error: '退回未完成，請稍後再試' }, 503)
  }
}
