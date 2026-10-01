import { allocationLabel, isAreaDispatched } from './allocation'
import { ministryCycle } from './ministry'
import { taipeiDate } from './google-sheets'

type HandoffArea = {
  id: string; name: string; mapId: string | null; mapAreaId: number | null; sheetNo: number | null
  assignedMemberId: string | null; dispatchedAt: Date | null; completedAt: Date | null
  ministryVisits: { cycleKey: string; status: string; publisherName: string; scheduledDate: string; submittedAt: Date | null }[]
}

export function ministryHandoff(area: HandoffArea) {
  if (!isAreaDispatched(area)) return null
  const visits = area.ministryVisits.filter(v => v.cycleKey === ministryCycle(area))
  if (visits.some(v => v.status === 'active')) return null
  const last = visits.filter(v => v.status === 'submitted').sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0))[0]
  if (!last) return null
  const next = visits.filter(v => v.status === 'planned').sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0]
  return { areaId: area.id, label: allocationLabel(area), publisher: last.publisherName, submittedDate: taipeiDate(last.submittedAt) || null, next: next ? { name: next.publisherName, date: next.scheduledDate } : null }
}
