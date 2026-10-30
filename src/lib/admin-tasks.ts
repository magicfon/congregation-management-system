import type { PrismaClient } from '@prisma/client'
import { allocationLabel } from './allocation'
import { ministryHandoff } from './ministry-handoffs'
import { taipeiDate } from './google-sheets'
import { ALERT_KINDS, AlertKind, describeAlert } from './report-alerts'

export async function adminTasks(db: PrismaClient) {
  const [lineCount, identities, requestCount, requests, areas, alertCount, alerts, doNotVisitCount, doNotVisitReports] = await Promise.all([
    db.pendingLineIdentity.count(),
    db.pendingLineIdentity.findMany({ take: 5, orderBy: [{ createdAt: 'asc' }, { uid: 'asc' }], select: { displayName: true, createdAt: true } }),
    db.mapRequest.count({ where: { status: 'pending' } }),
    db.mapRequest.findMany({ where: { status: 'pending' }, take: 5, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, createdAt: true, member: { select: { name: true } }, area: { select: { name: true, mapId: true, mapAreaId: true, sheetNo: true } } } }),
    db.area.findMany({ where: { assignedMemberId: { not: null }, ministryVisits: { some: { status: 'submitted' } } }, select: {
      id: true, name: true, mapId: true, mapAreaId: true, sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true,
      assignedMember: { select: { name: true } },
      ministryVisits: { where: { status: { in: ['planned', 'active', 'submitted'] } }, select: { cycleKey: true, status: true, publisherName: true, scheduledDate: true, submittedAt: true } },
    }, orderBy: { sheetNo: 'asc' } }),
    db.reportAlert.count({ where: { status: 'pending' } }),
    db.reportAlert.findMany({ where: { status: 'pending' }, take: 50, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, kind: true, details: true, createdAt: true, area: { select: { name: true, mapId: true, mapAreaId: true, sheetNo: true, assignedMemberId: true, dispatchedAt: true, completedAt: true, assignedMember: { select: { name: true } } } } } }),
    db.doNotVisitReport.count({ where: { status: 'pending' } }),
    db.doNotVisitReport.findMany({ where: { status: 'pending' }, take: 20, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, address: true, reporterName: true, createdAt: true, area: { select: { name: true, mapId: true, mapAreaId: true, sheetNo: true } } } }),
  ])
  const alertItems = alerts.map(alert => {
    const kind = (alert.kind in ALERT_KINDS ? alert.kind : 'sheet_holder_mismatch') as AlertKind
    return { id: alert.id, kind, badge: ALERT_KINDS[kind].badge, actions: ALERT_KINDS[kind].actions.map(a => ({ ...a })), label: allocationLabel(alert.area), date: taipeiDate(alert.createdAt), ...describeAlert(alert, alert.area.assignedMember?.name || '未記錄', taipeiDate(alert.area.dispatchedAt)) }
  })
  const handoffs = areas.flatMap(area => {
    const handoff = ministryHandoff(area)
    return handoff ? [{ ...handoff, manager: area.assignedMember?.name || '管理者未記錄' }] : []
  })
  return {
    line: { count: lineCount, items: identities.map(row => ({ name: row.displayName || '尚未取得 LINE 顯示名稱', date: taipeiDate(row.createdAt) })) },
    requests: { count: requestCount, items: requests.map(row => ({ id: row.id, name: row.member.name, label: allocationLabel(row.area), date: taipeiDate(row.createdAt) })) },
    handoffs: { count: handoffs.length, items: handoffs },
    alerts: { count: alertCount, items: alertItems },
    doNotVisit: { count: doNotVisitCount, items: doNotVisitReports.map(row => ({ id: row.id, label: allocationLabel(row.area), address: row.address, name: row.reporterName, date: taipeiDate(row.createdAt) })) },
  }
}
export type AdminTasks = Awaited<ReturnType<typeof adminTasks>>
