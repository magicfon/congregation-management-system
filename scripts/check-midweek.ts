import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseWeek, discoverIssues, discoverYears, officialUrl } from '../src/lib/midweek-import'
import { currentAndFutureWeeks, diffSources, isPastWeek, pastWeeks, newMeeting, nextMidweekCheck, timeline, validateMeeting } from '../src/lib/midweek'
const root = process.argv[2] || 'scripts/fixtures/midweek'
const completed = { month: '2026-10', completedAt: '2026-10-11T13:49:47Z', remaining: 0, errors: [] }
assert.equal(nextMidweekCheck(completed, new Date('2026-10-13T10:00:00Z')).toISOString(), '2026-10-31T19:00:00.000Z')
assert.equal(nextMidweekCheck({ ...completed, month: '2026-12' }, new Date('2026-12-31T10:00:00Z')).toISOString(), '2026-12-31T19:00:00.000Z')
assert.equal(nextMidweekCheck(completed, new Date('2026-10-31T17:00:00Z')).toISOString(), '2026-10-31T19:00:00.000Z')
assert.equal(nextMidweekCheck({ ...completed, errors: ['retry'] }, new Date('2026-10-13T19:00:00Z')).toISOString(), '2026-10-14T19:00:00.000Z')
assert.equal(nextMidweekCheck(null, new Date('2026-10-13T18:00:00Z')).toISOString(), '2026-10-13T19:00:00.000Z')
const choices = [{ date: '2027-01-08' }, { date: '2026-12-27' }, { date: '2026-12-28' }, { date: '2027-01-03' }]
assert.deepEqual(currentAndFutureWeeks(choices, '2027-01-03').map(w => w.date), ['2026-12-28', '2027-01-03', '2027-01-08'])
assert.deepEqual(currentAndFutureWeeks(choices, '2027-01-04').map(w => w.date), ['2027-01-08'])
assert.equal(choices[0].date, '2027-01-08', '週次篩選不改動原始清單')
assert.deepEqual(currentAndFutureWeeks([], '2027-01-04'), [])
assert.deepEqual(pastWeeks(choices, '2027-01-04').map(w => w.date), ['2027-01-03', '2026-12-28', '2026-12-27'], '過去週次最近的在前')
assert.equal(isPastWeek('2027-01-04', '2027-01-10'), false, '本週一不算過去')
assert.equal(isPastWeek('2027-01-03', '2027-01-04'), true)
const url = 'https://www.jw.org/cmn-hant/多媒體圖書館/耶和華見證人聚會手冊/聚會手冊2026年9-10月/傳道與生活聚會節目表2026年10月5-11日/'
const html = readFileSync(`${root}/midweek-week.html`, 'utf8')
const source = parseWeek(html, url)
assert.equal(source.week, '2026-10-05')
assert.equal(source.items.length, 14)
assert.equal(source.items[0].title, '唱詩第[33]首')
assert.equal(source.items[2].title, '耶和華每次都會救我們的命嗎？')
const meeting = newMeeting(source)
assert.equal(meeting.date, '2026-10-09')
assert.equal(timeline(meeting)[5].at, '8:01')
meeting.items[2].minutes += 5
assert.equal(timeline(meeting)[5].at, '8:06')
assert.equal(source.items[2].minutes, 10, '草稿修改不能改動來源')
assert.deepEqual(validateMeeting(meeting), meeting)
assert.throws(() => validateMeeting({ ...meeting, date: '2026-02-30' }))
assert.throws(() => validateMeeting({ ...meeting, items: [meeting.items[0], meeting.items[0]] }))
assert.throws(() => validateMeeting({ ...meeting, items: [{ ...meeting.items[0], minutes: -1 }] }))
assert.throws(() => officialUrl('https://evil.example/'))
assert.throws(() => parseWeek('<article><h1>10月5-11日</h1></article>', url))
const old = parseWeek(readFileSync(`${root}/midweek-old.html`, 'utf8'), url)
assert.equal(old.week, '2016-01-04')
assert.equal(old.items.length, 11)
assert.equal(discoverIssues(readFileSync(`${root}/midweek-2016.html`, 'utf8')).length, 12)
assert.ok(discoverYears(readFileSync(`${root}/midweek-index.html`, 'utf8')).length >= 11)
// Explicit synthetic title tests avoid depending on ruby formatting of the fixture.
const yearHtml = html.replace(/<h1[\s\S]*?<\/h1>/, '<h1>12月28日～1月3日</h1>').replace('iss-202609', 'iss-202701')
assert.equal(parseWeek(yearHtml, url).week, '2026-12-28')
for (const [name, count] of [['sidebar', 13], ['new-song', 13], ['2027', 13], ['memorial', 1]] as const) {
  const parsed = parseWeek(readFileSync(`${root}/midweek-${name}.html`, 'utf8'), url)
  assert.equal(parsed.items.length, count, name)
  if (name === 'new-song') assert.equal(parsed.items.at(-1)?.title, '唱2024年區域大會的新歌')
}
console.log('週中節目：新舊手冊、日期、轉場計時、輸入驗證與來源保護檢查通過')
{
  const it = (title: string, minutes = 5) => ({ section: 'living' as const, title, minutes })
  const rows = diffSources({ items: [it('A'), it('B'), it('C'), it('D')] }, { items: [it('A'), it('新增'), it('B', 7), it('D2'), it('C')] })
  assert.deepEqual(rows.map(r => [r.old?.title ?? null, r.new?.title ?? null, r.changed]), [['A', 'A', false], [null, '新增', true], ['B', 'B', true], [null, 'D2', true], ['C', 'C', false], ['D', null, true]], '多一項、少一項與分鐘變動都要標出')
  assert.deepEqual(diffSources({ items: [it('A'), it('B'), it('C')] }, { items: [it('A'), it('X'), it('C')] }).map(r => [r.old?.title, r.new?.title, r.changed]), [['A', 'A', false], ['B', 'X', true], ['C', 'C', false]], '改名的節目左右並排')
}
