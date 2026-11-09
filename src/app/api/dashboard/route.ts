import { NextResponse } from 'next/server'
import { requireApiUser } from '../../../lib/api-auth'
import { prisma } from '../../../lib/db'
import { allocationLabel, isAreaDispatched, idleCalendarDays } from '../../../lib/allocation'
import { ministryCycle } from '../../../lib/ministry'
import { ministryHandoff } from '../../../lib/ministry-handoffs'
import { taipeiDate } from '../../../lib/google-sheets'
import { personalAssignments } from '../../../lib/personal-assignments'
import { doNotVisitList } from '../../../lib/do-not-visit-list'
export const dynamic = 'force-dynamic'
export async function GET() {
  const auth = await requireApiUser()
  if ('response' in auth) return auth.response
  try {
    const memberId = auth.user.id!
    const isAdmin = auth.user.role === 'admin'
    const [areas, pendingRequests, reviewCount, assignments, member] = await Promise.all([
      prisma.area.findMany({ where: { assignedMemberId: memberId }, select: { id: true, name: true, mapId: true, mapAreaId: true, sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true, doNotVisit: true, ministryVisits: { select: { status: true, cycleKey: true, publisherName: true, scheduledDate: true, submittedAt: true } }, reports: { where: { memberId }, orderBy: { submittedAt: 'desc' }, take: 1, select: { submittedAt: true, status: true } } }, orderBy: { dispatchedAt: 'asc' } }),
      prisma.mapRequest.findMany({ where: { memberId, status: 'pending' }, select: { id: true, createdAt: true, area: { select: { name: true, mapId: true, mapAreaId: true, sheetNo: true } } }, orderBy: { createdAt: 'asc' } }),
      isAdmin ? prisma.mapRequest.count({ where: { status: 'pending' } }) : Promise.resolve(null),
      personalAssignments(prisma, memberId),
      prisma.member.findUnique({ where: { id: memberId }, select: { showInDispatch: true } }),
    ])
    const today = taipeiDate(new Date())
    const maps = areas.filter(isAreaDispatched).map(area => {
      const report = area.dispatchedAt && area.reports[0] && area.reports[0].submittedAt >= area.dispatchedAt ? area.reports[0] : null
      return { id: area.id, label: allocationLabel(area), sheetNo: area.sheetNo, doNotVisitCount: doNotVisitList(area.doNotVisit).length, dispatchedDate: taipeiDate(area.dispatchedAt) || null, heldDays: idleCalendarDays(taipeiDate(area.dispatchedAt) || null, today), ministryPending: area.ministryVisits.filter(v => v.cycleKey === ministryCycle(area) && v.status === 'planned').length, ministryActive: area.ministryVisits.some(v => v.cycleKey === ministryCycle(area) && v.status === 'active'), report: report ? { date: taipeiDate(report.submittedAt), status: report.status } : null }
    })
    const handoffs = areas.flatMap(area => {
      const handoff = ministryHandoff(area)
      return handoff ? [handoff] : []
    })
    return NextResponse.json({ showTerritory: member?.showInDispatch === true, today, assignments, handoffs, name: auth.user.name || '成員', isAdmin, maps, pendingRequests: pendingRequests.map(r => ({ id: r.id, label: allocationLabel(r.area), date: taipeiDate(r.createdAt) })), reviewCount }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '暫時無法讀取你的地圖，請稍後重試。' }, { status: 503 }) }
}
