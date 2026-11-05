export type Section = 'opening' | 'treasures' | 'ministry' | 'living'
export type Highlight = '' | 'yellow' | 'green'
export type MeetingItem = {
  id: string; section: Section; title: string; minutes: number; counsel: number
  role: string; person: string; assistant: string; highlight: Highlight
  timeHighlight?: Highlight; personHighlight?: Highlight
}
export type Meeting = {
  date: string; start: string; reading: string; chair: string; note: string
  noteHighlight: Highlight; items: MeetingItem[]
}
export type SourceWeek = { id: string; url: string; week: string; label: string; reading: string; items: MeetingItem[]; hash: string }
export type MeetingRecord = { revision: number; sourceHash: string; draft: Meeting; published: Meeting | null; publishedAt: string | null; publishedVersion?: number; draftBaseVersion?: number; versions?: import('./midweek-versions').MeetingVersion[]; versionDates?: Record<string, string | null>; draftOwner?: DraftOwner; sourceSnapshot?: SourceSnapshot }
// 草稿建立時的手冊原稿，手冊更新後拿來左右比對（ADR-0111）。
export type SourceSnapshot = { reading: string; items: MeetingItem[] }
// 草稿編輯者：有人儲存草稿後鎖定，發布或放棄前其他管理員不能編輯（ADR-0102）。
export type DraftOwner = { id: string; name: string; at: string }
export const sectionNames: Record<Section, string> = { opening: '', treasures: '上帝話語的寶藏', ministry: '用心準備傳道工作', living: '基督徒的生活' }
export const sectionColors: Record<Section, string> = { opening: '#575A5D', treasures: '#575A5D', ministry: '#BE8900', living: '#7E0024' }
export class MeetingError extends Error {}
export class MeetingConflict extends Error {}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}
export function newMeeting(source: SourceWeek): Meeting {
  return { date: addDays(source.week, 4), start: '19:30', reading: source.reading, chair: '', note: '', noteHighlight: '', items: structuredClone(source.items) }
}
export function sourceSnapshot(source: SourceWeek): SourceSnapshot {
  return { reading: source.reading, items: source.items.map(({ id, section, title, minutes }) => ({ id, section, title, minutes, counsel: 0, role: '', person: '', assistant: '', highlight: '' })) }
}
export type SourceDiffRow = { old?: { section: Section; title: string; minutes: number }; new?: { section: Section; title: string; minutes: number }; changed: boolean }
// 比對時忽略格式差異：舊草稿的節目名稱外層方括號、全形／半形連字號（ADR-0111）。
export function comparableText(text: string) {
  return text.replace(/^\[(.*)\]$/, '$1').replace(/[－–—]/g, '-').trim()
}
// 以節目名稱對齊兩份節目（最長共同子序列），名稱相同但分鐘數不同也算變動。
export function diffSources(before: { items: Pick<MeetingItem, 'section' | 'title' | 'minutes'>[] }, after: { items: Pick<MeetingItem, 'section' | 'title' | 'minutes'>[] }): SourceDiffRow[] {
  const a = before.items.map(({ section, title, minutes }) => ({ section, title, minutes })), b = after.items.map(({ section, title, minutes }) => ({ section, title, minutes }))
  const same = (x: string, y: string) => comparableText(x) === comparableText(y)
  const length = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) length[i][j] = same(a[i].title, b[j].title) ? length[i + 1][j + 1] + 1 : Math.max(length[i + 1][j], length[i][j + 1])
  const rows: SourceDiffRow[] = []
  let i = 0, j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && same(a[i].title, b[j].title)) { rows.push({ old: a[i], new: b[j], changed: a[i].minutes !== b[j].minutes }); i++; j++ }
    else if (i < a.length && j < b.length && length[i + 1][j] === length[i][j + 1]) { rows.push({ old: a[i], new: b[j], changed: true }); i++; j++ }
    else if (j >= b.length || (i < a.length && length[i + 1][j] >= length[i][j + 1])) rows.push({ old: a[i++], changed: true })
    else rows.push({ new: b[j++], changed: true })
  }
  return rows
}
// 本週一（台北日期字串），週中編排以此區分可編輯週與過去週。
export function weekMonday(today: string) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
  return addDays(today, -((weekday + 6) % 7))
}
export function isPastWeek(date: string, today: string) { return date < weekMonday(today) }
export function sourceChangeCount(before: { reading: string; items: Pick<MeetingItem, 'section' | 'title' | 'minutes'>[] }, after: SourceWeek) {
  return diffSources(before, after).filter(row => row.changed).length + (comparableText(before.reading) === comparableText(after.reading) ? 0 : 1)
}
export function currentAndFutureWeeks<T extends { date: string }>(weeks: T[], today: string): T[] {
  return weeks.filter(week => !isPastWeek(week.date, today)).sort((a, b) => a.date.localeCompare(b.date))
}
// 過去週次：最近的在前，只供閱覽（ADR-0112）。
export function pastWeeks<T extends { date: string }>(weeks: T[], today: string): T[] {
  return weeks.filter(week => isPastWeek(week.date, today)).sort((a, b) => b.date.localeCompare(a.date))
}
export function nextMidweekCheck(state: { month: string; completedAt: string | null; remaining: number; errors: unknown[] } | null, now = new Date()): Date {
  const local = new Date(now.getTime() + 8 * 3600000)
  const year = local.getUTCFullYear(), month = local.getUTCMonth(), day = local.getUTCDate()
  const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`
  // Matches the daily 19:00 UTC cron and its once-per-Taipei-month full scan.
  if (state?.month === currentMonth && state.completedAt && !state.remaining && !state.errors.length) return new Date(Date.UTC(year, month + 1, 1, -5))
  const next = new Date(Date.UTC(year, month, day, -5))
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next
}
export function timeline(meeting: Meeting) {
  let time = Number(meeting.start.slice(0, 2)) * 60 + Number(meeting.start.slice(3))
  return meeting.items.map(item => {
    const at = `${Math.floor(time / 60) % 12 || 12}:${String(time % 60).padStart(2, '0')}`
    time += item.minutes + item.counsel
    return { ...item, at }
  })
}
export function validateMeeting(value: unknown): Meeting {
  const fail = () => { throw new MeetingError('節目格式不完整，請檢查日期、名稱及分鐘數') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const v = value as Meeting
  const str = (x: unknown, n: number) => typeof x === 'string' && x.length <= n
  const highlight = (x: unknown) => ['', 'yellow', 'green'].includes(x as string)
  if (!str(v.date, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !Number.isFinite(Date.parse(v.date)) || addDays(v.date, 0) !== v.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.start)) return fail()
  if (!str(v.reading, 200) || !str(v.chair, 80) || !str(v.note, 300) || !highlight(v.noteHighlight) || !Array.isArray(v.items) || !v.items.length || v.items.length > 60) return fail()
  const ids = new Set<string>()
  for (const row of v.items) {
    if (!row || !str(row.id, 80) || !row.id || ids.has(row.id) || !Object.keys(sectionNames).includes(row.section) || !str(row.title, 300) || !row.title.trim() || !str(row.role, 40) || !str(row.person, 80) || !str(row.assistant, 80) || !highlight(row.highlight)) return fail()
    if (!Number.isInteger(row.minutes) || row.minutes < 0 || row.minutes > 180 || !Number.isInteger(row.counsel) || row.counsel < 0 || row.counsel > 30) return fail()
    if (!highlight(row.timeHighlight ?? '') || !highlight(row.personHighlight ?? '')) return fail()
    ids.add(row.id)
  }
  if (v.items.reduce((sum, r) => sum + r.minutes + r.counsel, 0) > 600) return fail()
  // Return only known fields, never persist arbitrary submitted properties.
  return { date: v.date, start: v.start, reading: v.reading, chair: v.chair, note: v.note, noteHighlight: v.noteHighlight, items: v.items.map(r => ({ id: r.id, section: r.section, title: r.title, minutes: r.minutes, counsel: r.counsel, role: r.role, person: r.person, assistant: r.assistant, highlight: r.highlight, ...(r.timeHighlight !== undefined ? { timeHighlight: r.timeHighlight } : {}), ...(r.personHighlight !== undefined ? { personHighlight: r.personHighlight } : {}) })) }
}
