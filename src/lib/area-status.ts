import { idleCalendarDays } from './allocation'

export type CompletionArea = { sheetNo: number | null; name: string; lastCompletedDate: string | null }
export type HeatReport = { number: number; name: string | null; lastCompletedDate: string | null; days: number | null }
export type HeatStatus = 'known' | 'unmatched' | 'no-report' | 'incomplete' | 'unsynced'
export const HEAT_STATUS_LABELS: Record<HeatStatus, string> = {
  known: '距上次完成回報', unmatched: '未配對區域編號', 'no-report': '無完成回報紀錄', incomplete: '日期或編號資料不完整', unsynced: '完成回報日期尚未同步',
}
export function heatColor(days: number | null): string {
  if (days === null || !Number.isFinite(days) || days < 0) return '#64748b'
  const stops = [[34, 197, 94], [250, 204, 21], [239, 68, 68]]
  const value = Math.min(days, 180), segment = value < 90 ? 0 : 1, t = (value - segment * 90) / 90
  return '#' + stops[segment].map((v, i) => Math.round(v + (stops[segment + 1][i] - v) * t).toString(16).padStart(2, '0')).join('')
}
export function regionHeat(numbers: number[], areas: CompletionArea[], today: string, synced: boolean) {
  const reports: HeatReport[] = [...new Set(numbers)].sort((a, b) => a - b).map(number => {
    const matches = areas.filter(a => a.sheetNo === number)
    const area = matches.length === 1 ? matches[0] : null
    return { number, name: area?.name || null, lastCompletedDate: area?.lastCompletedDate || null, days: idleCalendarDays(area?.lastCompletedDate || null, today) }
  })
  const status: HeatStatus = !reports.length ? 'unmatched' : !synced ? 'unsynced'
    : reports.some(r => !r.name) ? 'incomplete' : reports.every(r => !r.lastCompletedDate) ? 'no-report'
    : reports.some(r => r.days === null) ? 'incomplete' : 'known'
  const days = status === 'known' ? Math.max(...reports.map(r => r.days!)) : null
  return { status, days, color: heatColor(days), reports }
}
export type HeatRegion = ReturnType<typeof regionHeat> & { candidateId: string; numbers: number[]; polygons: number[][][][]; pixelArea: number }
export type AreaStatusData = {
  mapId: string; today: string; syncedAt: string | null; sourceImage: string; imageSize: number[]
  boundary: { source: 'cloud' | 'original'; version: number | null; updatedAt: string | null }
  regions: HeatRegion[]; unlocatedNumbers: number[]
}
