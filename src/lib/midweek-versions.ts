import { MeetingError, timeline, type Meeting, type MeetingRecord } from './midweek'

export type Marks = Record<string, number>
export type MeetingVersion = { number: number; date: string | null; meeting: Meeting; marks: Marks }
export type Palette = Record<string, string>
export const defaultPalette: Palette = { 2: '#ffff00', 3: '#00ff00', 4: '#bae6fd', 5: '#e9d5ff', 6: '#fed7aa' }
export const fieldKey = (id: string, field: string) => `item:${id}:${field}`
export function versionColor(number: number, palette: Palette = {}) {
  if (number < 2) return undefined
  if (palette[number] || defaultPalette[number]) return palette[number] || defaultPalette[number]
  const hue = (number * 137.508) % 360 / 60, chroma = .234, x = chroma * (1 - Math.abs(hue % 2 - 1)), m = .733
  const rgb = hue < 1 ? [chroma,x,0] : hue < 2 ? [x,chroma,0] : hue < 3 ? [0,chroma,x] : hue < 4 ? [0,x,chroma] : hue < 5 ? [x,0,chroma] : [chroma,0,x]
  return '#' + rgb.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('')
}
export function localDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function contentFields(meeting: Meeting): Record<string, string | number> {
  const result: Record<string, string | number> = {}
  for (const key of ['date', 'start', 'reading', 'chair', 'note'] as const) result[key] = meeting[key]
  timeline(meeting).forEach((item, index) => {
    for (const key of ['title', 'minutes', 'counsel', 'role', 'person', 'assistant', 'section', 'at'] as const) result[fieldKey(item.id, key)] = item[key]
    result[fieldKey(item.id, 'order')] = index
  })
  return result
}
export function sameContent(a: Meeting, b: Meeting) {
  const left = contentFields(a), right = contentFields(b)
  return Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([key, value]) => right[key] === value)
}
export function legacyVersion(meeting: Meeting): MeetingVersion {
  const marks: Marks = {}
  const mark = (key: string, color: string | undefined) => { if (color === 'yellow' || color === 'green') marks[key] = color === 'yellow' ? 2 : 3 }
  mark('note', meeting.noteHighlight)
  meeting.items.forEach(item => {
    for (const key of ['title', 'minutes']) mark(fieldKey(item.id, key), item.highlight)
    mark(fieldKey(item.id, 'at'), item.timeHighlight)
    for (const key of ['person', 'assistant']) if (item[key as 'person' | 'assistant']) mark(fieldKey(item.id, key), item.personHighlight)
  })
  const number = Math.max(1, ...Object.values(marks))
  // Only infer a date when one explicit update date belongs to the current note color.
  const matches = [...meeting.note.matchAll(/(\d{1,2})\/(\d{1,2})\s*更新/g)]
  let date: string | null = null
  if (matches.length === 1 && marks.note === number) {
    const candidate = `${meeting.date.slice(0,4)}-${matches[0][1].padStart(2,'0')}-${matches[0][2].padStart(2,'0')}`
    if (Number.isFinite(Date.parse(candidate)) && new Date(candidate).toISOString().slice(0,10) === candidate && candidate <= meeting.date && Math.abs(Date.parse(meeting.date)-Date.parse(candidate)) < 90*86400000) date = candidate
  }
  return { number, date, meeting: structuredClone(meeting), marks }
}
export function versionsOf(record: MeetingRecord): MeetingVersion[] {
  return record.versions ?? (record.published ? [legacyVersion(record.published)] : [])
}
export function publishedVersionOf(record: MeetingRecord): MeetingVersion | undefined {
  const versions = versionsOf(record)
  return versions.find(version => version.number === record.publishedVersion) ?? versions.at(-1)
}
export function previewVersion(meeting: Meeting, previous?: MeetingVersion): MeetingVersion {
  if (!previous) return { number: 1, date: null, meeting, marks: {} }
  const before = contentFields(previous.meeting), after = contentFields(meeting)
  const marks: Marks = {}
  for (const [key, value] of Object.entries(after)) {
    if (value === '' && before[key] === undefined) continue
    if (before[key] !== value) marks[key] = previous.number + 1
    else if (previous.marks[key]) marks[key] = previous.marks[key]
  }
  return { number: previous.number + (sameContent(meeting, previous.meeting) ? 0 : 1), date: null, meeting, marks }
}
export function validatePalette(value: unknown): Palette {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 200) throw new MeetingError('配色格式錯誤')
  const result: Palette = {}
  for (const [key, color] of Object.entries(value)) {
    if (!/^[1-9]\d*$/.test(key) || Number(key) < 2 || Number(key) > 10000 || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new MeetingError('配色格式錯誤')
    result[key] = color
  }
  return result
}
