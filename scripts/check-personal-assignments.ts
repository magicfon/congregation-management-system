import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { personalAssignments, assignmentsText } from '../src/lib/personal-assignments'
import { lineBotAnswer } from '../src/lib/line-bot-queries'
import type { Meeting } from '../src/lib/midweek'

async function main() {
  let members: { id: string; name: string; gender?: string }[] = [{ id: 'me', name: '王小明' }, { id: 'other', name: '陳小華' }]
  let person: { id: string } | null = { id: 'person' }
  let active = true
  const meeting: Meeting = { date: '2026-10-16', start: '19:30', chair: '王小明', reading: '', note: '', noteHighlight: '', items: [
    { id: 'talk', section: 'ministry', title: '開始交談', minutes: 3, counsel: 1, role: '學生/助手', person: '王小明', assistant: '陳小華', highlight: '' },
    { id: 'help', section: 'ministry', title: '培養興趣', minutes: 4, counsel: 1, role: '學生/助手', person: '陳小華', assistant: ' 王小明 ', highlight: '' },
  ] }
  const records = [
    { key: 'midweek:record:current', value: JSON.stringify({ published: meeting, draft: { ...meeting, chair: '陳小華' }, versions: [{ number: 99, meeting: { ...meeting, chair: '陳小華' } }] }) },
    { key: 'midweek:record:draft', value: JSON.stringify({ published: null, draft: meeting }) },
    { key: 'midweek:record:past', value: JSON.stringify({ published: { ...meeting, date: '2026-10-09' } }) },
    { key: 'midweek:record:future', value: JSON.stringify({ published: { ...meeting, date: '2027-01-01' } }) },
  ]
  const db = {
    member: { findMany: async () => members, findUnique: async () => ({ id: 'me', active }) },
    servicePerson: { findUnique: async () => person },
    serviceWeek: { findMany: async () => [
      { startDate: '2026-10-12', endDate: '2026-10-18', stopped: false, assignments: { micA: { personId: 'person', name: '舊姓名' }, audio: { personId: 'person', name: '王小明' }, stage: { personId: 'else', name: '王小明' }, watchtower: { personId: 'person', name: '王小明' } } },
      { startDate: '2026-10-19', endDate: '2026-10-25', stopped: true, assignments: { audio: { personId: 'person', name: '王小明' } } },
    ] },
    setting: { findMany: async () => records },
  } as unknown as PrismaClient
  const now = new Date('2026-10-17T02:00:00Z')
  const data = await personalAssignments(db, 'me', now)
  assert.equal(data.upcoming.length, 9)
  assert.equal(data.past.length, 3)
  assert.equal(data.upcoming.filter(i => i.kind === 'service').length, 2)
  assert.equal(data.upcoming.filter(i => i.kind === 'program').length, 7)
  assert.equal(data.upcoming.find(i => i.title === '守望台朗讀')?.kind, 'program')
  assert.equal(data.upcoming.filter(i => i.role === '助手').length, 2)
  assert.equal(data.upcoming.filter(i => i.role === '學生').length, 2)
  assert.equal(data.upcoming.filter(i => i.title === '主席').length, 2)
  assert(!data.upcoming.some(i => i.id.includes('draft')))
  assert(!data.upcoming.some(i => i.title === '講台'))
  assert.match(await lineBotAnswer(db, 'uid', '我的委派', now), /開始交談（學生）/)
  assert.match(assignmentsText(data, 'https://example.test/dashboard'), /完整委派與過去紀錄/)
  const long = assignmentsText({ ...data, upcoming: Array.from({ length: 100 }, (_, i) => ({ ...data.upcoming[0], title: '很長的節目'.repeat(60), id: String(i) })) }, 'https://example.test/dashboard')
  assert(long.length <= 4500)
  assert.match(long, /另有 \d+ 項/)
  assert.match(long, /https:\/\/example.test\/dashboard\/assignments\/service/)
  assert.match(long, /https:\/\/example.test\/dashboard\/assignments\/program/)
  const sunday = await personalAssignments(db, 'me', new Date('2026-10-18T15:59:59Z'))
  const monday = await personalAssignments(db, 'me', new Date('2026-10-18T16:00:00Z'))
  assert.equal(sunday.upcoming.length, 9)
  assert.equal(monday.upcoming.length, 3)
  assert.equal(data.showBrotherService, true)
  members[0].gender = 'brother'
  assert.deepEqual(await personalAssignments(db, 'me', now), data)
  members[0].gender = 'sister'
  const sister = await personalAssignments(db, 'me', now)
  assert.equal(sister.showBrotherService, false)
  assert.equal(sister.upcoming.length, 7)
  assert.equal(sister.past.length, 3)
  assert(sister.upcoming.every(item => item.kind === 'program'))
  assert(sister.past.every(item => item.kind === 'program'))
  assert(sister.upcoming.some(item => item.role === '學生'))
  assert(sister.upcoming.some(item => item.role === '助手'))
  const reply = await lineBotAnswer(db, 'uid', '我的委派', now)
  assert(!reply.includes('弟兄服務'))
  assert(!reply.includes('/assignments/service'))
  assert(reply.includes('/assignments/program'))
  person = null
  assert(!(await personalAssignments(db, 'me', now)).notices.some(text => text.includes('服務安排')))
  person = { id: 'person' }
  members[0].gender = 'unspecified'
  assert.deepEqual(await personalAssignments(db, 'me', now), data)
  members = [...members, { id: 'duplicate', name: ' 王小明 ' }]
  assert.equal((await personalAssignments(db, 'me', now)).upcoming.length, 3)
  assert.match((await personalAssignments(db, 'me', now)).notices.join(''), /姓名/)
  person = null
  const empty = await personalAssignments(db, 'me', now)
  assert.equal(empty.upcoming.length, 0)
  assert.match(assignmentsText(empty, 'https://example.test'), /沒有本週/)
  active = false
  assert.match(await lineBotAnswer(db, 'uid', '我的委派', now), /停用/)
  console.log('PASS: personal identity, published snapshots, all roles, stopped weeks, Taipei week boundary, duplicate names, LINE query and long replies')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
