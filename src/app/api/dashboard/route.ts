import { NextResponse } from 'next/server'
import { requireApiUser } from '../../../lib/api-auth'
import { prisma } from '../../../lib/db'
import { allocationLabel, isAreaDispatched, idleCalendarDays } from '../../../lib/allocation'
import { ministryCycle } from '../../../lib/ministry'
import { taipeiDate } from '../../../lib/google-sheets'
export const dynamic = 'force-dynamic'
export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const memberId = auth.user.id!
    const isAdmin = auth.user.role === 'admin'
    const [areas, pendingRequests, reviewCount, assignedVisits] = await Promise.all([
      prisma.area.findMany({ where: { assignedMemberId: memberId }, select: { id: true, name: true, mapId: true, mapAreaId: true, sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true, ministryVisits: { select: { status: true, cycleKey: true, publisherName: true, scheduledDate: true, submittedAt: true } }, reports: { where: { memberId }, orderBy: { submittedAt: 'desc' }, take: 1, select: { submittedAt: true, status: true } } }, orderBy: { dispatchedAt: 'asc' } }),
      prisma.mapRequest.findMany({ where: { memberId, status: 'pending' }, select: { id: true, createdAt: true, area: { select: { name: true, mapId: true, mapAreaId: true, sheetNo: true } } }, orderBy: { createdAt: 'asc' } }),
      isAdmin ? prisma.mapRequest.count({ where: { status: 'pending' } }) : Promise.resolve(null),
      prisma.ministryVisit.findMany({ where: { publisherId: memberId, status: { in: ['planned', 'active'] } }, include: { area: { select: { id: true, name: true, mapId: true, sheetNo: true, mapAreaId: true, assignedMemberId: true, dispatchedAt: true, completedAt: true } } }, orderBy: { scheduledDate: 'asc' } }),
    ])
    const today = taipeiDate(new Date())
    const maps = areas.filter(isAreaDispatched).map(area => {
      const report = area.dispatchedAt && area.reports[0] && area.reports[0].submittedAt >= area.dispatchedAt ? area.reports[0] : null
      return { id: area.id, label: allocationLabel(area), sheetNo: area.sheetNo, dispatchedDate: taipeiDate(area.dispatchedAt) || null, heldDays: idleCalendarDays(taipeiDate(area.dispatchedAt) || null, today), ministryPending: area.ministryVisits.filter(v => v.cycleKey === ministryCycle(area) && v.status === 'planned').length, ministryActive: area.ministryVisits.some(v => v.cycleKey === ministryCycle(area) && v.status === 'active'), report: report ? { date: taipeiDate(report.submittedAt), status: report.status } : null }
    })
    const handoffs = areas.filter(isAreaDispatched).flatMap(area => {
      const visits = area.ministryVisits.filter(v => v.cycleKey === ministryCycle(area))
      if (visits.some(v => v.status === 'active')) return []
      const last = visits.filter(v => v.status === 'submitted').sort((a,b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0))[0]
      if (!last) return []
      const next = visits.filter(v => v.status === 'planned').sort((a,b) => a.scheduledDate.localeCompare(b.scheduledDate))[0]
      return [{ areaId: area.id, label: allocationLabel(area), publisher: last.publisherName, submittedDate: taipeiDate(last.submittedAt) || null, next: next ? { name: next.publisherName, date: next.scheduledDate } : null }]
    })
    const tasks = assignedVisits.filter(v => isAreaDispatched(v.area) && v.cycleKey === ministryCycle(v.area)).map(v => ({ id: v.id, areaId: v.areaId, label: allocationLabel(v.area), date: v.scheduledDate, status: v.status }))
    return NextResponse.json({ handoffs, tasks, name: auth.user.name || '成員', isAdmin, maps, pendingRequests: pendingRequests.map(r => ({ id: r.id, label: allocationLabel(r.area), date: taipeiDate(r.createdAt) })), reviewCount }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '暫時無法讀取你的地圖，請稍後重試。' }, { status: 503 }) }
}
