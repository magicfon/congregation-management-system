export const DISTRICT_NAMES: Record<string, string> = { nanzih: '楠梓', chiaotou: '橋頭', tzuguan: '梓官' }
const DISTRICT_ORDER = ['nanzih', 'chiaotou', 'tzuguan']

export type AllocationArea = {
  id: string; name: string; mapId: string | null; mapAreaId: number | null
  sheetNo: number | null; blockCode: string | null; assignedTo: string | null
  isDispatched: boolean; lastCompletedDate: string | null; idleDays: number | null
}

export function isAreaDispatched(area: { assignedMemberId: string | null; dispatchedAt: Date | null; completedAt: Date | null }) {
  return Boolean(area.assignedMemberId && (!area.dispatchedAt || !area.completedAt || area.dispatchedAt >= area.completedAt))
}

export function allocationOrder(a: Pick<AllocationArea, 'mapId' | 'blockCode' | 'sheetNo' | 'mapAreaId'>, b: Pick<AllocationArea, 'mapId' | 'blockCode' | 'sheetNo' | 'mapAreaId'>) {
  const rank = (id: string | null) => DISTRICT_ORDER.includes(id || '') ? DISTRICT_ORDER.indexOf(id!) : 99
  return rank(a.mapId) - rank(b.mapId)
    || (a.blockCode || '').localeCompare(b.blockCode || '', 'zh-TW', { numeric: true })
    || (a.sheetNo ?? a.mapAreaId ?? 9999) - (b.sheetNo ?? b.mapAreaId ?? 9999)
}

export function idleCalendarDays(completedDate: string | null, today: string): number | null {
  if (!completedDate) return null
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${completedDate}T00:00:00Z`)) / 86400000
  return Number.isFinite(days) && days >= 0 ? Math.floor(days) : null
}

export function allocationLabel(area: Pick<AllocationArea, 'mapId' | 'sheetNo' | 'mapAreaId' | 'name'>) {
  const no = area.sheetNo ?? area.mapAreaId
  return `${DISTRICT_NAMES[area.mapId || ''] || '其他'} ${no === null ? area.name : `${no} 號`}`
}
