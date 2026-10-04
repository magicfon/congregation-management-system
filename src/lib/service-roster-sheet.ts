import { spreadsheetRequest, taipeiDate } from './google-sheets'
import { SERVICE_SHEET_ID } from './service-roster-import'
import { addDays, validMonday, weekLabel, type ServiceRole } from './service-roster'
import { normalized, sameWeek, SyncError, type SyncWeek, type RemoteWeek } from './service-roster-sync-plan'

type Cell = { userEnteredValue?: { formulaValue?: string }; effectiveValue?: { numberValue?: number; stringValue?: string; boolValue?: boolean } }
type Merge = { startRowIndex?: number; endRowIndex: number; startColumnIndex?: number; endColumnIndex: number }
type Grid = { properties: { title: string; gridProperties: { rowCount: number; columnCount: number } }; merges?: Merge[]; data?: { rowData?: { values?: Cell[] }[] }[] }
export type SheetSource = { sheets: Grid[]; rows: RemoteWeek[]; fingerprint: string }
const roleColumns: ServiceRole[] = ['host', 'backup', 'attendant', 'watchtower', 'micA', 'micB', 'stage', 'video', 'audio', 'chair', 'reader']
const expectedHeaders = ['招待當值', '替補招待', '會堂招待員', '守望台朗讀', '麥克風傳遞員A', '麥克風傳遞員B', '講台', '影像控制', '音響控制', '周中聚會主席', '周中聚會朗讀']
const value = (cell?: Cell): string | number | boolean => cell?.effectiveValue?.numberValue ?? cell?.effectiveValue?.stringValue ?? cell?.effectiveValue?.boolValue ?? ''
const text = (cell?: Cell) => String(value(cell)).trim()
function date(cell?: Cell) {
  const v = value(cell)
  if (typeof v === 'number' && Number.isInteger(v) && v > 30000 && v < 100000) return taipeiDate(new Date(Date.UTC(1899, 11, 30, 4) + v * 86400000))
  if (typeof v === 'string' && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v)) {
    const [y, m, d] = v.split(/[-/]/).map(Number)
    return taipeiDate(new Date(Date.UTC(y, m - 1, d, 4)))
  }
  throw new SyncError('Google 日期必須包含年份或使用真正的日期儲存格')
}
export function parseSheets(sheets: Grid[]): SheetSource {
  const rows: RemoteWeek[] = []
  for (const title of ['Schedule', 'History']) {
    const sheet = sheets.find(s => s.properties.title === title)
    if (!sheet) throw new SyncError(`找不到 ${title} 工作表`)
    const data = sheet.data?.[0]?.rowData ?? [], header = data[0]?.values ?? []
    if (text(header[0]) !== '週別' || text(header[1]) !== '日期' || expectedHeaders.some((label, i) => text(header[i + 4]).replace(/\s/g, '').replace(/週/g, '周') !== label.replace(/週/g, '周'))) throw new SyncError(`${title} 欄位標題不符，已停止同步`)
    if ((text(header[15]) && text(header[15]) !== '備註') || (text(header[16]) && text(header[16]) !== '停排')) throw new SyncError(`${title} 的 P/Q 欄已有其他用途，請先保留空白供備註與停排使用`)
    const seen = new Set<string>()
    for (let i = 1; i < data.length; i++) {
      const cells = data[i].values ?? []
      if (!cells.some(cell => text(cell))) continue
      if (!/^\d+$/.test(text(cells[0]))) throw new SyncError(`${title} 第 ${i + 1} 列週別無效`)
      const startDate = date(cells[1]), endDate = date(cells[3])
      if (!validMonday(startDate) || addDays(startDate, 6) !== endDate || seen.has(startDate)) throw new SyncError(`${title} 日期無效或週次重複`)
      seen.add(startDate)
      const legacy = cells.slice(4, 15).map(text).filter(s => /【停排】|大會|停會|没有.*聚會|沒有.*聚會|無.*聚會/.test(s))
      const status = text(cells[16]).toLowerCase()
      if (!['', 'true', 'false', '是', '否', '1', '0'].includes(status)) throw new SyncError(`${title} ${startDate} 停排欄請填 TRUE 或 FALSE`)
      const stopped = status ? ['true', '是', '1'].includes(status) : legacy.length > 0
      const note = text(cells[15]) || (stopped ? legacy.map(s => s.replace(/^【停排】/, '')).join('；') : '')
      if (note.length > 300 || (stopped && !note)) throw new SyncError(`${title} ${startDate} 請填有效停排原因或備註（最多 300 字）`)
      const names = Object.fromEntries(roleColumns.flatMap((role, j) => stopped || !text(cells[j + 4]) ? [] : [[role, text(cells[j + 4])]]))
      rows.push({ sheet: title, row: i + 1, week: normalized({ startDate, endDate, stopped, note, names }) })
    }
  }
  return { sheets, rows, fingerprint: JSON.stringify(sheets) }
}
export async function readRosterSheet(): Promise<SheetSource> {
  const fields = 'sheets(properties(title,gridProperties),merges,data(rowData(values(userEnteredValue,effectiveValue))))'
  const result = await spreadsheetRequest(SERVICE_SHEET_ID, `?ranges=Schedule!A:Q&ranges=History!A:Q&includeGridData=true&fields=${encodeURIComponent(fields)}`)
  return parseSheets(result.sheets)
}
const serial = (day: string) => Math.round((new Date(`${day}T04:00:00Z`).getTime() - Date.UTC(1899, 11, 30, 4)) / 86400000)
export function prepareWrites(source: SheetSource, targets: SyncWeek[]) {
  const data: { range: string; values: (string | number)[][] }[] = []
  let pushed = 0
  for (const sheet of source.sheets) {
    const title = sheet.properties.title
    const rows = sheet.data?.[0]?.rowData ?? []
    let appendRow = Math.max(2, rows.length + 1)
    const updates = targets.flatMap(target => {
      const remote = source.rows.find(row => row.sheet === title && row.week.startDate === target.startDate)
      // History covers every week; Schedule keeps its existing window plus newly created future weeks.
      if (!remote && title === 'Schedule' && target.endDate < taipeiDate(new Date())) return []
      if (remote && sameWeek(remote.week, target)) return []
      return [{ target, row: remote?.row ?? appendRow++, fresh: !remote }]
    })
    if (!updates.length) continue
    if (sheet.properties.gridProperties.columnCount < 17 || appendRow - 1 > sheet.properties.gridProperties.rowCount) throw new SyncError(`${title} 請先增加空白列或擴充到 Q 欄`)
    for (const { target, row, fresh } of updates) {
      const values: (string | number)[] = [Number(weekLabel(target.startDate).split('W')[1]), serial(target.startDate), '~', serial(target.endDate), ...roleColumns.map((role, i) => target.stopped ? i === 0 ? `【停排】${target.note}` : '' : target.names[role] ?? ''), target.note, target.stopped ? 'TRUE' : 'FALSE']
      for (let column = fresh ? 0 : 4; column < 17; column++) {
        const cell = rows[row - 1]?.values?.[column]
        if (cell?.userEnteredValue?.formulaValue) throw new SyncError(`${title} 第 ${row} 列包含公式，請先確認後改用值再同步`)
        const merge = sheet.merges?.find(m => row - 1 >= (m.startRowIndex ?? 0) && row - 1 < m.endRowIndex && column >= (m.startColumnIndex ?? 0) && column < m.endColumnIndex)
        if (merge) {
          if (merge.endRowIndex - (merge.startRowIndex ?? 0) > 1) throw new SyncError(`${title} 第 ${row} 列跨週合併，請先取消合併`)
          if (column !== (merge.startColumnIndex ?? 0)) {
            if (values[column] !== '') throw new SyncError(`${title} 第 ${row} 列工作欄已合併，請先取消合併再同步`)
            continue
          }
        }
        if (String(value(cell)) === String(values[column])) continue
        data.push({ range: `'${title}'!${String.fromCharCode(65 + column)}${row}`, values: [[values[column]]] })
      }
      pushed++
    }
    for (const [col, label] of [[15, '備註'], [16, '停排']] as const) {
      if (!text(rows[0]?.values?.[col])) data.push({ range: `'${title}'!${String.fromCharCode(65 + col)}1`, values: [[label]] })
    }
  }
  return { data, pushed }
}
export async function writeRosterSheet(source: SheetSource, targets: SyncWeek[]) {
  const prepared = prepareWrites(source, targets)
  if (!prepared.data.length) return 0
  const latest = await readRosterSheet()
  if (latest.fingerprint !== source.fingerprint) throw new SyncError('Google 在同步期間有修改，請重新同步')
  await spreadsheetRequest(SERVICE_SHEET_ID, '/values:batchUpdate', { valueInputOption: 'RAW', data: prepared.data })
  const verified = await readRosterSheet()
  for (const target of targets) {
    const copies = verified.rows.filter(row => row.week.startDate === target.startDate)
    if (!copies.length || copies.some(row => !sameWeek(row.week, target))) throw new SyncError('Google 寫入後驗證不一致，已保留原快照，請重新同步')
  }
  return prepared.pushed
}
