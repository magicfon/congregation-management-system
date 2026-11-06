// 地圖資訊的最近回報紀錄：讀 Sheet「傳道區域回報」（A 時間戳記、B 姓名、D 區號、F 結束日）（ADR-0107）
export type AreaReportEntry = { date: string; name: string }
export const RECENT_REPORT_LIMIT = 3

/** Sheet 日期可能是 2026/10/30、2026-10-30、2026/10/30 下午 7:41:23 或序號，統一成 YYYY-MM-DD。 */
export function reportSheetDate(value: unknown): string | null {
  const text = String(value ?? '').trim()
  const parts = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (parts) return `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`
  if (/^\d+(\.\d+)?$/.test(text) && Number(text) > 40000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(text)) * 86400000).toISOString().slice(0, 10)
  return null
}

/** 每區依結束日由新到舊取前幾筆；同人同日的重複送出只算一次。 */
export function recentReports(rows: string[][], sheetNos: number[], limit = RECENT_REPORT_LIMIT) {
  const wanted = new Set(sheetNos)
  const byNo = new Map<number, { entry: AreaReportEntry; order: number }[]>()
  rows.forEach((row, order) => {
    const no = Number(row[3])
    if (!wanted.has(no)) return
    const date = reportSheetDate(row[5]) ?? reportSheetDate(row[0])
    const name = String(row[1] ?? '').trim()
    if (!date) return
    const list = byNo.get(no) ?? []
    if (!list.some(i => i.entry.date === date && i.entry.name === name)) list.push({ entry: { date, name }, order })
    byNo.set(no, list)
  })
  return Object.fromEntries(sheetNos.map(no => [no, (byNo.get(no) ?? [])
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.order - a.order)
    .slice(0, limit).map(i => i.entry)]))
}
