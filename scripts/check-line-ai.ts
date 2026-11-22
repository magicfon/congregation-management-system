// LINE AI 問答檢查（ADR-0143）：不連資料庫、不呼叫 API，用假的 db 與 client 驗證流程。
import assert from 'node:assert/strict'
import { lineAiAnswer, lineAiDailyLimit, lineAiKnowledge } from '../src/lib/line-ai'

const now = new Date('2026-11-20T04:00:00Z')
type Row = { uid: string; role: string; content: string; createdAt: Date }

function fakeDb(rows: Row[], used = 0) {
  const saved: unknown[] = []
  const db = {
    member: {
      findUnique: async () => ({ name: '王小明', gender: 'brother', role: 'publisher', showInDispatch: true }),
      findMany: async () => [{ id: 'm1', name: '王小明', gender: 'brother' }],
    },
    servicePerson: { findUnique: async () => null },
    serviceWeek: { findMany: async () => [{ startDate: '2026-11-16', endDate: '2026-11-22', stopped: false, note: '', assignments: { host: { personId: 'p2', name: '陳志強' } } }] },
    setting: { findMany: async () => [] },
    area: { findMany: async ({ where }: any) => where.assignedMemberId?.not === null ? [{ mapId: 'nanzih', sheetNo: 12, mapAreaId: 12, name: '', assignedMemberId: 'm2', dispatchedAt: new Date('2026-11-01T00:00:00Z'), completedAt: null, assignedMember: { name: '李大華' } }] : [] },
    mapRequest: { findMany: async () => [] },
    lineAiMessage: {
      count: async () => used,
      findMany: async () => [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      createMany: async ({ data }: { data: unknown[] }) => { saved.push(...data) },
    },
  }
  return { db: db as never, saved }
}

function fakeClient(answer: string) {
  const calls: any[] = []
  const client = async (params: any) => { calls.push(params); return { choices: [{ message: { content: answer }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 0 } } } }
  return { calls, client }
}

async function main() {
  const knowledge = await lineAiKnowledge()
  assert.match(knowledge, /怎麼申請地圖/)
  assert.doesNotMatch(knowledge, /LINE 問答知識庫/, 'README 不放進知識庫')

  // 每日上限：不呼叫模型。
  {
    const { db, saved } = fakeDb([], lineAiDailyLimit)
    const { client, calls } = fakeClient('x')
    const result = await lineAiAnswer(db, 'm1', 'U1', '怎麼申請地圖', now, client)
    assert.equal(result.answered, false)
    assert.equal(calls.length, 0)
    assert.equal(saved.length, 0)
  }

  // 正常回答：知識庫在快取的 system，個人資料只放在本次提問，歷史交替且以 user 開頭。
  {
    const history: Row[] = [
      { uid: 'U1', role: 'assistant', content: '孤兒回覆', createdAt: new Date(now.getTime() - 5000) },
      { uid: 'U1', role: 'user', content: '第一題', createdAt: new Date(now.getTime() - 4000) },
      { uid: 'U1', role: 'assistant', content: '第一答', createdAt: new Date(now.getTime() - 3000) },
      { uid: 'U1', role: 'user', content: '沒回到的題', createdAt: new Date(now.getTime() - 2000) },
    ]
    const { db, saved } = fakeDb(history)
    const { client, calls } = fakeClient('到傳道地圖申請。')
    const result = await lineAiAnswer(db, 'm1', 'U1', '怎麼申請地圖？', now, client)
    assert.equal(result.text, '到傳道地圖申請。')
    const params = calls[0]
    assert.equal(params.model, 'glm-5.3-flash')
    assert.equal(params.messages[0].role, 'system')
    assert.match(params.messages[0].content, /<knowledge>/)
    assert.doesNotMatch(params.messages[0].content, /王小明|陳志強/, '固定前綴不放會變動的資料，才能命中快取')
    assert.match(params.messages[1].content, /<congregation>[\s\S]*招待當值：陳志強[\s\S]*李大華：楠梓 12 號/)
    const roles = params.messages.slice(2).map((m: any) => m.role)
    assert.equal(roles[0], 'user')
    roles.forEach((role: string, i: number) => i && assert.notEqual(role, roles[i - 1], '角色需交替'))
    const last = params.messages.at(-1)
    assert.doesNotMatch(params.messages[1].content, /王小明/)
    assert.match(last.content, /<member>[\s\S]*王小明[\s\S]*<\/member>/)
    assert.match(last.content, /<question>\n怎麼申請地圖？\n<\/question>/)
    assert.equal(saved.length, 2)
  }
  console.log('check-line-ai: ok')
}

main().catch(error => { console.error(error); process.exit(1) })
