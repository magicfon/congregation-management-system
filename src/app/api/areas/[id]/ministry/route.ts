import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { drainLineNotifications } from '../../../../../lib/line-notifications'
import { prisma } from '../../../../../lib/db'
import { requireApiUser } from '../../../../../lib/api-auth'
import { allocationLabel, isAreaDispatched } from '../../../../../lib/allocation'
import { ministryCycle, changeMinistry, MinistryError, type MinistryCommand } from '../../../../../lib/ministry'
import { readSnapshot, updateSnapshot, updateValues, DEFAULT_SHEET_ID } from '../../../../../lib/google-sheets'
import images from '../../../../../../public/maps/areas/index.json'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const area = await prisma.area.findUnique({ where: { id: params.id }, include: { assignedMember: { select: { name: true } } } })
    if (!area) return respond({ error: '地圖不存在' }, 404)
    const cycleKey = ministryCycle(area), isManager = auth.user.role === 'admin' || area.assignedMemberId === auth.user.id
    const participant = await prisma.ministryVisit.findFirst({ where: { areaId: area.id, cycleKey, publisherId: auth.user.id! } })
    if (!isManager && (!participant || !isAreaDispatched(area))) return respond({ error: '未獲指派此地圖' }, 403)
    const [visits, members] = await Promise.all([
      prisma.ministryVisit.findMany({ where: { areaId: area.id, ...(isManager ? {} : { cycleKey }) }, orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }] }),
      isManager ? prisma.member.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
    ])
    const image = area.sheetNo ? (images as unknown as Record<string, { full: string; dims: number[] }>)[String(area.sheetNo)] : null
    return respond({ area: { id: area.id, label: allocationLabel(area), managerName: area.assignedMember?.name || area.assignedTo || '未記錄', active: isAreaDispatched(area), revision: area.ministryRevision, cycleKey, image: image ? { url: image.full, dims: image.dims } : null }, viewerId: auth.user.id, isManager, members, visits })
  } catch { return respond({ error: '無法讀取傳道安排，請重試' }, 503) }
}
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const text = await request.text()
    if (Buffer.byteLength(text) > 600000) return respond({ error: '筆跡資料過大，請減少筆跡' }, 413)
    const body = JSON.parse(text) as MinistryCommand
    if (!body || !['plan','reschedule','start','cancel','save','submit','finish'].includes(body.action) || typeof body.cycleKey !== 'string' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || (body.visitId !== undefined && typeof body.visitId !== 'string') || (body.publisherId !== undefined && typeof body.publisherId !== 'string')) return respond({ error: '操作資料無效' }, 400)
    if (body.action === 'finish') {
      const snapshot = await readSnapshot()
      if (snapshot.size !== 213 || Array.from({ length: 213 }, (_, i) => i + 1).some(no => !snapshot.has(no))) return respond({ error: '同步快照不完整，暫時不能交回' }, 503)
    }
    const result = await changeMinistry(prisma, params.id, { id: auth.user.id!, isAdmin: auth.user.role === 'admin' }, body)
    let warning = ''
    if (body.action === 'finish' && result.sheetNo) {
      try {
        await updateValues(DEFAULT_SHEET_ID, `區域狀態!C${result.sheetNo + 1}:C${result.sheetNo + 1}`, [['']])
        await updateSnapshot([{ sheetNo: result.sheetNo, member: '', date: null, keepDate: true }])
      } catch { warning = '地圖已交回，Sheet 尚待同步，請勿重複交回。' }
    }
    if (result.notificationIds.length) {
      try { await drainLineNotifications(prisma, result.notificationIds) }
      catch { /* Committed outbox can be retried independently. */ }
    }
    return respond({ revision: result.revision, sheetNo: result.sheetNo, warning })
  } catch (error) {
    if (error instanceof MinistryError) return respond({ error: error.message }, error.status)
    if (error instanceof SyntaxError) return respond({ error: '資料格式無效' }, 400)
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034','P2002'].includes(error.code)) return respond({ error: '其他裝置同時更新，請重新載入' }, 409)
    return respond({ error: '操作未完成，請先重新載入確認結果' }, 503)
  }
}
