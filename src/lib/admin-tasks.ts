import type { PrismaClient } from '@prisma/client'
import { allocationLabel } from './allocation'
import { ministryHandoff } from './ministry-handoffs'
import { taipeiDate } from './google-sheets'
import { reportedButHeld } from './territory-report'

export async function adminTasks(db: PrismaClient) {
  const [lineCount, identities, requestCount, requests, areas, heldAreas] = await Promise.all([
    db.pendingLineIdentity.count(),
    db.pendingLineIdentity.findMany({ take: 5, orderBy: [{ createdAt: 'asc' }, { uid: 'asc' }], select: { displayName: true, createdAt: true } }),
    db.mapRequest.count({ where: { status: 'pending' } }),
    db.mapRequest.findMany({ where: { status: 'pending' }, take: 5, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, createdAt: true, member: { select: { name: true } }, area: { select: { name: true, mapId: true, mapAreaId: true, sheetNo: true } } } }),
    db.area.findMany({ where: { assignedMemberId: { not: null }, ministryVisits: { some: { status: 'submitted' } } }, select: {
      id: true, name: true, mapId: true, mapAreaId: true, sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true,
      assignedMember: { select: { name: true } },
      ministryVisits: { where: { status: { in: ['planned', 'active', 'submitted'] } }, select: { cycleKey: true, status: true, publisherName: true, scheduledDate: true, submittedAt: true } },
    }, orderBy: { sheetNo: 'asc' } }),
    db.area.findMany({ where: { assignedMemberId: { not: null }, dispatchedAt: { not: null }, lastReportedCompletedAt: { not: null } }, select: {
      id: true, name: true, mapId: true, mapAreaId: true, sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true, lastReportedCompletedAt: true,
      assignedMember: { select: { name: true } },
    }, orderBy: { sheetNo: 'asc' } }),
  ])
  const unreturned = heldAreas.filter(reportedButHeld).map(area => ({ areaId: area.id, label: allocationLabel(area), holder: area.assignedMember?.name || '未記錄', dispatched: taipeiDate(area.dispatchedAt), reported: taipeiDate(area.lastReportedCompletedAt) }))
  const handoffs = areas.flatMap(area => {
    const handoff = ministryHandoff(area)
    return handoff ? [{ ...handoff, manager: area.assignedMember?.name || '管理者未記錄' }] : []
  })
  return {
    line: { count: lineCount, items: identities.map(row => ({ name: row.displayName || '尚未取得 LINE 顯示名稱', date: taipeiDate(row.createdAt) })) },
    requests: { count: requestCount, items: requests.map(row => ({ id: row.id, name: row.member.name, label: allocationLabel(row.area), date: taipeiDate(row.createdAt) })) },
    handoffs: { count: handoffs.length, items: handoffs },
    unreturned: { count: unreturned.length, items: unreturned },
  }
}
export type AdminTasks = Awaited<ReturnType<typeof adminTasks>>
