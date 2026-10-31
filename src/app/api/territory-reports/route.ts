import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { allocationLabel, isAreaDispatched } from '../../../lib/allocation'
import { appendValues, batchUpdate, readSnapshot, taipeiDate, updateSnapshot, DEFAULT_SHEET_ID } from '../../../lib/google-sheets'
import { brothersOnlyBlocked, BROTHERS_ONLY_MESSAGE, parseReportInput, submitTerritoryReport, TerritoryReportError, MAX_REPORT_AREAS, REPORT_SHEET_RANGE, REPORT_TIMESLOTS } from '../../../lib/territory-report'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

async function currentUser() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; name?: string | null; role?: string } | undefined
  return user?.id ? { id: user.id, name: user.name || '', admin: user.role === 'admin' } : null
}

// GET /api/territory-reports — 回報表單選項。過渡期免登入；未登入不揭露持有人
export async function GET() {
  const user = await currentUser()
  try {
    const areas = await prisma.area.findMany({ where: { sheetNo: { not: null } }, include: { assignedMember: { select: { name: true } } }, orderBy: { sheetNo: 'asc' } })
    const list = areas.map(area => {
      const active = isAreaDispatched(area)
      return { sheetNo: area.sheetNo!, label: allocationLabel(area), holderId: active ? area.assignedMemberId : null, holder: active ? area.assignedMember?.name || area.assignedTo || '未記錄' : null, dispatched: active ? taipeiDate(area.dispatchedAt) : null }
    })
    if (await brothersOnlyBlocked(prisma, user?.id ?? null, Boolean(user?.admin))) return respond({ restricted: BROTHERS_ONLY_MESSAGE, guest: false, admin: false, name: user?.name || '', today: taipeiDate(new Date()), timeslots: [], maxAreas: 0, held: [], areas: [] })
    return respond({
      guest: !user,
      admin: Boolean(user?.admin),
      name: user?.name || '',
      today: taipeiDate(new Date()),
      timeslots: REPORT_TIMESLOTS,
      maxAreas: MAX_REPORT_AREAS,
      held: user ? list.filter(area => area.holderId === user.id).map(({ holderId: _, ...area }) => area) : [],
      areas: list.map(({ holderId: _, ...area }) => user ? area : { ...area, holder: null, dispatched: null }),
    })
  } catch { return respond({ error: '無法讀取區域資料，請重新整理' }, 503) }
}

// POST /api/territory-reports — 送出回報：寫入 Sheet「傳道區域回報」，需要時自動交回
export async function POST(request: NextRequest) {
  const user = await currentUser()
  try {
    const body = await request.json()
    const input = parseReportInput(body, new Date(), !user)
    const snapshot = await readSnapshot()
    if (snapshot.size !== 213 || Array.from({ length: 213 }, (_, i) => i + 1).some(no => !snapshot.has(no))) return respond({ error: '同步快照不完整，暫時不能回報，請稍後再試' }, 503)
    const results = await submitTerritoryReport(prisma, user?.id ?? null, input, rows => appendValues(DEFAULT_SHEET_ID, REPORT_SHEET_RANGE, rows), new Date(), { admin: user?.admin, confirmed: body?.confirmed === true })
    const returned = results.filter(result => result.action === 'return' || result.action === 'proxy').map(result => result.sheetNo)
    const pending = results.filter(result => result.action === 'confirm' || result.action === 'merge').map(result => result.sheetNo)
    let warning = ''
    if (returned.length) {
      try {
        await batchUpdate(DEFAULT_SHEET_ID, returned.map(no => ({ range: `區域狀態!C${no + 1}:C${no + 1}`, values: [['']] })))
        await updateSnapshot(returned.map(sheetNo => ({ sheetNo, member: '', date: null, keepDate: true })))
      } catch { warning = '回報已送出、地圖已交回，區域狀態表稍後會自動同步。' }
    }
    return respond({ ok: true, returned, pending, warning }, 201)
  } catch (error) {
    if (error instanceof TerritoryReportError) return respond({ error: error.message }, error.status)
    if (error instanceof SyntaxError) return respond({ error: '資料格式無效' }, 400)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return respond({ error: '其他人同時更新這張地圖，請重新送出' }, 409)
    console.error('POST /api/territory-reports error:', error)
    return respond({ error: '回報未送出，請稍後再試' }, 503)
  }
}
