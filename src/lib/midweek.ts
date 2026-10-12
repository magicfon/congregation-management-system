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
export type MeetingRecord = { revision: number; sourceHash: string; draft: Meeting; published: Meeting | null; publishedAt: string | null }
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
