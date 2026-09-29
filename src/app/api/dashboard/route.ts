import { NextResponse } from 'next/server'
import { requireApiUser } from '../../../lib/api-auth'
import { prisma } from '../../../lib/db'
import { allocationLabel, isAreaDispatched, idleCalendarDays } from '../../../lib/allocation'
import { taipeiDate } from '../../../lib/google-sheets'
export const dynamic = 'force-dynamic'
export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const memberId = auth.user.id!
    const isAdmin = auth.user.role === 'admin'
    const [areas, pendingRequests, reviewCount] = await Promise.all([
      prisma.area.findMany({ where: { assignedMemberId: memberId }, select: { id: true, name: true, mapId: true, mapAreaId: true, sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true, reports: { where: { memberId }, orderBy: { submittedAt: 'desc' }, take: 1, select: { submittedAt: true, status: true } } }, orderBy: { dispatchedAt: 'asc' } }),
      prisma.mapRequest.findMany({ where: { memberId, status: 'pending' }, select: { id: true, createdAt: true, area: { select: { name: true, mapId: true, mapAreaId: true, sheetNo: true } } }, orderBy: { createdAt: 'asc' } }),
      isAdmin ? prisma.mapRequest.count({ where: { status: 'pending' } }) : Promise.resolve(null),
    ])
    const today = taipeiDate(new Date())
    const maps = areas.filter(isAreaDispatched).map(area => {
      const report = area.dispatchedAt && area.reports[0] && area.reports[0].submittedAt >= area.dispatchedAt ? area.reports[0] : null
      return { id: area.id, label: allocationLabel(area), sheetNo: area.sheetNo, dispatchedDate: taipeiDate(area.dispatchedAt) || null, heldDays: idleCalendarDays(taipeiDate(area.dispatchedAt) || null, today), report: report ? { date: taipeiDate(report.submittedAt), status: report.status } : null }
    })
    return NextResponse.json({ name: auth.user.name || '成員', isAdmin, maps, pendingRequests: pendingRequests.map(r => ({ id: r.id, label: allocationLabel(r.area), date: taipeiDate(r.createdAt) })), reviewCount }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '暫時無法讀取你的地圖，請稍後重試。' }, { status: 503 }) }
}
