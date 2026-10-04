import { dateDay, addDays, validMonday, serviceRoles, type ServiceRole } from './service-roster'
export const SERVICE_SHEET_ID = '1mEUaWpY6yAUTtXJP1gXVhKezt8413uadoPLN4t3e10Y'
// Google L/M are video/audio, while the website displays audio/video.
const sourceRoles: ServiceRole[] = ['host', 'backup', 'attendant', 'watchtower', 'micA', 'micB', 'stage', 'video', 'audio', 'chair', 'reader']
type Cell = { v?: string | number | null } | null
export type SourceRow = { c: Cell[] }
export type SourceWeek = { startDate: string; endDate: string; note: string; stopped: boolean; names: Partial<Record<ServiceRole, string>> }
const text = (row: SourceRow, column: number) => String(row.c[column]?.v ?? '').trim()
function sourceDate(value: string) {
  const match = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,[^)]*)?\)$/.exec(value)
  if (!match) throw new Error('來源日期缺少年份，匯入已停止')
  return dateDay(new Date(Date.UTC(Number(match[1]), Number(match[2]), Number(match[3]), 4)))
}
export function parseSourceWeeks(rows: SourceRow[]) {
  const weeks = new Map<string, SourceWeek>()
  for (const row of rows) {
    if (!text(row, 0)) continue
    if (!/^\d+(?:\.0)?$/.test(text(row, 0))) throw new Error('來源週別格式錯誤')
    const startDate = sourceDate(text(row, 1)), endDate = sourceDate(text(row, 3))
    if (!validMonday(startDate) || endDate !== addDays(startDate, 6) || weeks.has(startDate)) throw new Error('來源日期或重複週次錯誤')
    const notes = serviceRoles.map((_, i) => text(row, i + 4)).filter(value => /大會|停會|没有.*聚會|沒有.*聚會|無.*聚會/.test(value))
    const names: SourceWeek['names'] = {}
    const status = text(row, 16).toLowerCase()
    const stopped = status ? ['true', '是', '1'].includes(status) : notes.length > 0 || text(row, 4).startsWith('【停排】')
    if (!stopped) sourceRoles.forEach((role, i) => { const name = text(row, i + 4); if (name) names[role] = name })
    weeks.set(startDate, { startDate, endDate, stopped, note: text(row, 15) || (stopped ? (notes.join('；') || text(row, 4)).replace(/^【停排】/, '') : ''), names })
  }
  return weeks
}
export function parsePeople(rows: SourceRow[]) {
  const labels: Record<string, ServiceRole> = { '麥克風傳遞員A': 'micA', '麥克風傳遞員B': 'micB', '講台': 'stage', '影像控制': 'video', '音響控制': 'audio' }
  const people = new Map<string, ServiceRole[]>()
  for (const row of rows) {
    const label = text(row, 0).replace(/\s/g, '')
    if (!label) continue
    const role = labels[label] ?? serviceRoles.find(role => role.label.replace(/\s/g, '') === label)?.id
    if (!role) throw new Error(`People 包含未知職務：${label}`)
    for (const name of text(row, 1).split(/[,，、]/).map(name => name.trim()).filter(Boolean)) people.set(name, [...new Set([...(people.get(name) ?? []), role])])
  }
  return people
}
async function readSource(sheet: string): Promise<SourceRow[]> {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${SERVICE_SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${sheet}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Google 輪值資料暫時無法讀取')
  const body = await response.text()
  const match = /google\.visualization\.Query\.setResponse\(([\s\S]+)\);?\s*$/.exec(body)
  if (!match) throw new Error('Google 回傳格式錯誤')
  const data = JSON.parse(match[1])
  if (data.status !== 'ok' || !Array.isArray(data.table?.rows) || !(sheet === 'People' ? [2] : [15, 17]).includes(data.table.cols?.length)) throw new Error('Google 欄位不符，匯入已停止')
  return data.table.rows
}
export async function readServiceSource() {
  const [schedule, history, people] = await Promise.all(['Schedule', 'History', 'People'].map(readSource))
  const weeks = parseSourceWeeks(history)
  for (const [key, value] of parseSourceWeeks(schedule)) weeks.set(key, value)
  if (!weeks.size) throw new Error('來源沒有有效週次')
  return { weeks: [...weeks.values()].sort((a, b) => a.startDate.localeCompare(b.startDate)), qualifications: parsePeople(people) }
}
