import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/db'
import { requireApiUser } from '../../../lib/api-auth'
import { allocationLabel, isAreaDispatched } from '../../../lib/allocation'
import { appendValues, readSnapshot, taipeiDate, updateSnapshot, updateValues, DEFAULT_SHEET_ID } from '../../../lib/google-sheets'
import { parseReportInput, submitTerritoryReport, TerritoryReportError, REPORT_SHEET_RANGE, REPORT_TIMESLOTS } from '../../../lib/territory-report'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

// GET /api/territory-reports — 回報表單選項：自己領取中的地圖與 1–213 區目前狀態
export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const areas = await prisma.area.findMany({ where: { sheetNo: { not: null } }, include: { assignedMember: { select: { name: true } } }, orderBy: { sheetNo: 'asc' } })
    const list = areas.map(area => {
      const active = isAreaDispatched(area)
      return { sheetNo: area.sheetNo!, label: allocationLabel(area), holderId: active ? area.assignedMemberId : null, holder: active ? area.assignedMember?.name || area.assignedTo || '未記錄' : null, dispatched: active ? taipeiDate(area.dispatchedAt) : null }
    })
    return respond({
      name: auth.user.name || '',
      today: taipeiDate(new Date()),
      timeslots: REPORT_TIMESLOTS,
      held: list.filter(area => area.holderId === auth.user.id).map(({ holderId: _, ...area }) => area),
      areas: list.map(({ holderId: _, ...area }) => area),
    })
  } catch { return respond({ error: '無法讀取區域資料，請重新整理' }, 503) }
}

// POST /api/territory-reports — 送出回報：寫入 Sheet「傳道區域回報」，需要時自動交回
export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const input = parseReportInput(await request.json())
    const snapshot = await readSnapshot()
    if (snapshot.size !== 213 || Array.from({ length: 213 }, (_, i) => i + 1).some(no => !snapshot.has(no))) return respond({ error: '同步快照不完整，暫時不能回報，請稍後再試' }, 503)
    const result = await submitTerritoryReport(prisma, auth.user.id!, input, row => appendValues(DEFAULT_SHEET_ID, REPORT_SHEET_RANGE, [row]))
    let warning = ''
    if (result.returned) {
      try {
        await updateValues(DEFAULT_SHEET_ID, `區域狀態!C${result.sheetNo + 1}:C${result.sheetNo + 1}`, [['']])
        await updateSnapshot([{ sheetNo: result.sheetNo, member: '', date: null, keepDate: true }])
      } catch { warning = '回報已送出、地圖已交回，區域狀態表稍後會自動同步。' }
    }
    return respond({ ok: true, returned: result.returned, warning }, 201)
  } catch (error) {
    if (error instanceof TerritoryReportError) return respond({ error: error.message }, error.status)
    if (error instanceof SyntaxError) return respond({ error: '資料格式無效' }, 400)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return respond({ error: '其他人同時更新這張地圖，請重新送出' }, 409)
    console.error('POST /api/territory-reports error:', error)
    return respond({ error: '回報未送出，請稍後再試' }, 503)
  }
}
