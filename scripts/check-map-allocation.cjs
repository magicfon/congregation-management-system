// Isolated regression checks: never reads credentials, Sheet, or a real database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(path, mocks = {}) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const context = { exports: {}, process, console, URL, require: (id) => id in mocks ? mocks[id] : require(id) }
  vm.runInNewContext(js, context, { filename: path })
  return context.exports
}

async function main() {
  const sheets = load('src/lib/google-sheets.ts')
  const allocation = load('src/lib/allocation.ts')
  const sync = load('src/lib/report-completion-sync.ts', { './google-sheets': sheets })
  const dispatch = load('src/lib/batch-dispatch.ts', { './allocation': allocation })
  const now = new Date('2026-09-20T02:00:00Z')
  for (const timezone of ['UTC', 'Asia/Taipei', 'America/Los_Angeles']) {
    process.env.TZ = timezone
    const date = sync.parseCompletionDate('2026/9/19', now)
    assert.equal(sheets.taipeiDate(date), '2026-09-19')
    assert.equal(date.toISOString(), '2026-09-18T16:00:00.000Z')
    assert.equal(allocation.idleCalendarDays(sheets.taipeiDate(date), sheets.taipeiDate(now)), 1)
    assert.equal(allocation.idleCalendarDays('2026-09-19', sheets.taipeiDate(new Date('2026-09-19T16:01:00Z'))), 1)
  }
  assert.equal(sync.parseCompletionDate('', now), null)
  assert.equal(sync.parseCompletionDate('0', now), null)
  assert.equal(allocation.idleCalendarDays(null, '2026-09-20'), null)
  assert.equal(allocation.idleCalendarDays('2026-09-20', '2026-09-20'), 0)
  assert.equal(allocation.idleCalendarDays('2026-09-21', '2026-09-20'), null)
  for (const invalid of ['#N/A', '2026/2/30', '2026/13/1', '2026/9/21']) assert.throws(() => sync.parseCompletionDate(invalid, now))
  const serial = (Date.UTC(2026, 8, 19) - Date.UTC(1899, 11, 30)) / 86400000
  assert.equal(sheets.taipeiDate(sync.parseCompletionDate(String(serial), now)), '2026-09-19')

  const rows = Array.from({ length: 213 }, (_, i) => ['A-1', String(i + 1), '', '', '2026/9/19'])
  assert.equal(sync.completionRows(rows, now).size, 213)
  assert.throws(() => sync.completionRows(rows.slice(1), now))
  assert.throws(() => sync.completionRows([...rows.slice(1), rows[1]], now))
  const stored = new Map()
  const tx = {
    area: { count: async () => 213 },
    setting: { upsert: async () => {} },
    $executeRaw: async (query) => {
      assert(!query.sql.includes('"dispatchedAt"'))
      assert(!query.sql.includes('"completedAt"'))
      let changed = 0
      for (let i = 0; i < query.values.length; i += 2) {
        const [no, date] = query.values.slice(i, i + 2)
        const value = date?.getTime() ?? null
        if (stored.get(no) !== value) { changed++; stored.set(no, value) }
      }
      return changed
    },
  }
  const syncDb = { $transaction: async (fn) => fn(tx) }
  assert.equal((await sync.syncReportCompletions(syncDb, rows, now)).updated, 213)
  assert.equal((await sync.syncReportCompletions(syncDb, rows, now)).updated, 0)
  const corrected = rows.map((row) => [...row]); corrected[0][4] = ''
  assert.equal((await sync.syncReportCompletions(syncDb, corrected, now)).updated, 1)
  assert.equal(stored.get(1), null)
  tx.area.count = async () => 212
  await assert.rejects(sync.syncReportCompletions(syncDb, rows, now), /213/)

  const sorted = [
    { mapId: 'chiaotou', blockCode: 'B-1', sheetNo: 90 },
    { mapId: 'nanzih', blockCode: 'A-10', sheetNo: 10 },
    { mapId: 'nanzih', blockCode: 'A-2', sheetNo: 3 },
    { mapId: 'nanzih', blockCode: 'A-2', sheetNo: 2 },
  ].sort(allocation.allocationOrder)
  assert.equal(sorted.map((a) => a.sheetNo).join(','), '2,3,10,90')
  const completed = new Date('2026-08-01T00:00:00Z')
  const oldDispatch = new Date('2026-07-01T00:00:00Z')
  let areas = [
    { id: 'a', sheetNo: 1, assignedMemberId: null, dispatchedAt: null, completedAt: null, lastReportedCompletedAt: completed },
    { id: 'b', sheetNo: 2, assignedMemberId: 'old', dispatchedAt: oldDispatch, completedAt: completed, lastReportedCompletedAt: completed },
  ]
  let member = { id: 'member', name: '測試成員', active: true }
  let updates = 0
  const db = { $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    return fn({
      member: { findUnique: async () => member },
      area: {
        findMany: async ({ where }) => structuredClone(areas.filter((area) => where.id.in.includes(area.id))),
        updateMany: async ({ data }) => {
          assert.equal(data.lastReportedCompletedAt, undefined)
          updates++
          return { count: 2 }
        },
      },
    })
  } }
  assert.equal((await dispatch.batchDispatch(db, ['a', 'b'], 'member', null, now)).count, 2)
  assert.equal(updates, 1)
  assert.equal(areas[0].lastReportedCompletedAt, completed)
  areas[0].assignedMemberId = 'other'
  await assert.rejects(dispatch.batchDispatch(db, ['a', 'b'], 'member', null, now), /已被領取/)
  assert.equal(updates, 1, 'conflict must reject the entire batch before any write')
  areas[0].assignedMemberId = null; member.active = false
  await assert.rejects(dispatch.batchDispatch(db, ['a', 'b'], 'member', null, now), /停用/)
  member.active = true
  await assert.rejects(dispatch.batchDispatch(db, ['missing'], 'member', null, now), /不存在/)
  assert.equal(allocation.isAreaDispatched({ assignedMemberId: 'm', dispatchedAt: completed, completedAt: completed }), true)

  const forbidden = new Response(null, { status: 403 })
  const authMocks = {
    '../../../../lib/api-auth': { requireApiUser: async (roles) => { assert.equal(roles[0], 'admin'); return { response: forbidden } } },
    '../../../../lib/db': { prisma: {} },
    '../../../../lib/google-sheets': {},
    '../../../../lib/batch-dispatch': dispatch,
  }
  const endpoint = load('src/app/api/areas/dispatch-batch/route.ts', authMocks)
  assert.equal((await endpoint.POST({})).status, 403)
  const adminEndpoint = load('src/app/api/areas/dispatch-batch/route.ts', {
    ...authMocks,
    '../../../../lib/api-auth': { requireApiUser: async () => ({ user: { role: 'admin' } }) },
    '../../../../lib/google-sheets': { readSnapshot: async () => new Map() },
  })
  assert.equal((await adminEndpoint.POST({ json: async () => ({ areaIds: ['a', 'a'], memberId: 'member' }) })).status, 400)
  assert.equal((await adminEndpoint.POST({ json: async () => ({ areaIds: ['a'], memberId: 'member' }) })).status, 503)
  console.log('PASS: Taipei date boundaries, missing/invalid dates, complete 213-area sync, second sync zero, regional ordering, no report-date reset, whole-batch conflict rejection, admin-only dispatch, full-snapshot guard')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
