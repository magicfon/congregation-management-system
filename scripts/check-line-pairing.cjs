// Runs against isolated in-memory members; never connects to a database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(path, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const context = { exports: {}, process, console, URL, require: (name) => name in mocks ? mocks[name] : require(name) }
  vm.runInNewContext(code, context, { filename: path })
  return context.exports
}

const uid = 'U' + 'a'.repeat(32)
const initial = () => [
  { id: 'source', name: '原成員', lineuid: uid, lineDisplayName: 'LINE暱稱', active: true, role: 'publisher', email: 'a@example.com' },
  { id: 'target', name: '真實姓名', lineuid: null, lineDisplayName: null, active: true, role: 'publisher', email: 'b@example.com' },
]

function database() {
  let rows = initial()
  let failTarget = false
  const member = {
    findUnique: async ({ where }) => structuredClone(rows.find((r) => Object.entries(where).every(([key, value]) => r[key] === value)) || null),
    update: async ({ where, data }) => {
      if (failTarget && where.id === 'target') throw new Error('simulated write failure')
      const row = rows.find((r) => r.id === where.id)
      Object.assign(row, data)
      return row
    },
    create: async ({ data }) => { const row = { id: 'new', ...data }; rows.push(row); return row },
  }
  return {
    member,
    rows: () => rows,
    fail: () => { failTarget = true },
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      const snapshot = structuredClone(rows)
      try { return await fn({ member }) } catch (e) { rows = snapshot; throw e }
    },
  }
}

async function main() {
  const pairing = load('src/lib/line-pairing.ts')
  let db = database()
  await pairing.pairLineMember(db, 'source', 'target', uid)
  assert.equal(db.rows()[0].lineuid, null)
  assert.equal(db.rows()[1].lineuid, uid)
  assert.equal(db.rows()[1].lineDisplayName, 'LINE暱稱')
  assert.equal(db.rows()[1].name, '真實姓名')
  assert.equal(db.rows().length, 2)
  await assert.rejects(pairing.pairLineMember(db, 'source', 'target', uid), /來源/)
  for (const scenario of ['same', 'occupied', 'inactive', 'stale']) {
    db = database()
    if (scenario === 'occupied') db.rows()[1].lineuid = 'another'
    if (scenario === 'inactive') db.rows()[1].active = false
    await assert.rejects(pairing.pairLineMember(db, 'source', scenario === 'same' ? 'source' : 'target', scenario === 'stale' ? 'stale' : uid))
    assert.equal(db.rows()[0].lineuid, uid)
  }
  db = database(); db.fail()
  await assert.rejects(pairing.pairLineMember(db, 'source', 'target', uid), /simulated/)
  assert.equal(db.rows()[0].lineuid, uid)

  db = database()
  const { authOptions } = load('src/lib/auth.ts', { './db': { prisma: db } })
  const { signIn, jwt } = authOptions.callbacks
  const account = { provider: 'line', providerAccountId: uid }
  assert.equal(await signIn({ account, profile: { name: '新暱稱' } }), true)
  assert.equal(db.rows()[0].lineDisplayName, '新暱稱')
  assert.equal(db.rows()[0].name, '原成員')
  let token = await jwt({ token: { sub: uid }, account })
  assert.equal(token.id, 'source')
  await pairing.pairLineMember(db, 'source', 'target', uid)
  token = await jwt({ token })
  assert.equal(token.id, undefined, 'old LINE session must lose identity after pairing')
  assert.equal(token.role, undefined)
  const legacy = await jwt({ token: { id: 'source', role: 'admin', sub: uid } })
  assert.equal(legacy.id, undefined)
  token = await jwt({ token: { sub: uid }, account })
  assert.equal(token.id, 'target')
  assert.equal(token.name, '真實姓名')
  db.rows()[1].active = false
  assert.equal(await signIn({ account, profile: { name: '新暱稱' } }), false)
  assert.equal((await jwt({ token })).id, undefined)
  await signIn({ account: { provider: 'line', providerAccountId: 'U' + 'b'.repeat(32) }, profile: { name: '新人', email: 'b@example.com' } })
  assert.equal(db.rows().length, 3, 'email must not silently link a different identity')
  assert.equal(db.rows()[2].role, 'publisher')

  const fields = load('src/lib/member-fields.ts')
  assert.equal(fields.memberFields.password, undefined)
  assert.equal(fields.memberLineFields.password, undefined)
  let query
  for (const role of ['publisher', 'admin']) {
    const route = load('src/app/api/members/route.ts', {
      '../../../lib/api-auth': { requireApiUser: async () => ({ user: { role } }) },
      '../../../lib/db': { prisma: { member: { findMany: async (q) => { query = q; return [] } } } },
      '../../../lib/member-fields': fields,
    })
    const res = await route.GET({ url: 'https://example.com/api/members?search=LINE' })
    assert.equal(res.status, 200)
    assert.equal(query.select.lineuid, role === 'admin' ? true : undefined)
    assert.equal(query.select.password, undefined)
  }
  const forbidden = new Response(null, { status: 403 })
  const route = load('src/app/api/members/line-pairing/route.ts', {
    '../../../../lib/api-auth': { requireApiUser: async (roles) => { assert.equal(roles[0], 'admin'); return { response: forbidden } } },
    '../../../../lib/db': { prisma: {} },
    '../../../../lib/line-pairing': { ...pairing, pairLineMember: () => { throw new Error('must not be called') } },
  })
  assert.equal((await route.POST({})).status, 403)
  console.log('PASS: pairing, stale/conflicting bindings, rollback, profile refresh, session invalidation, re-login, disabled users, no email auto-link, safe fields, admin authorization')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
