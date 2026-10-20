// Exercise the real entry component with isolated SDK/session dependencies.
// No LINE requests, database connection, or stored credentials.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const uid = 'U' + 'a'.repeat(32)

async function enter({ session = { user: { id: 'm1', lineUid: uid } }, sub = uid,
  view = 'maps', loggedIn = true, sessionError = false, cancelled = false, pending = false } = {}) {
  const calls = { signIn: 0, session: 0, redirects: [], errors: [] }
  let effect
  let initialized = false
  const liff = {
    init: async () => { initialized = true },
    isLoggedIn: () => loggedIn,
    getDecodedIDToken: () => sub ? { sub } : null,
    getIDToken: () => 'raw-token',
  }
  const mocks = {
    react: { useEffect: fn => { effect = fn }, useState: initial => [initial, value => calls.errors.push(value)] },
    'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
    '@line/liff': { __esModule: true, default: liff },
    'next-auth/react': {
      getSession: async () => { calls.session++; if (sessionError) throw Error('offline'); return session },
      signIn: async (provider, options) => {
        assert.equal(initialized, true)
        assert.equal(provider, 'liff')
        assert.equal(options.idToken, 'raw-token')
        calls.signIn++
        return pending ? { error: 'LinePending' } : { ok: true }
      },
    },
    '../../lib/liff-settings': {
      liffDestination: value => { assert.equal(initialized, true, 'restore state before reading destination'); return value === 'bulletin' ? '/bulletin' : '/dashboard?view=maps' },
    },
  }
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync('src/app/liff/LiffEntry.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, { exports, URLSearchParams, require: name => mocks[name] ?? require(name),
    window: { location: { search: '?view=' + view, replace: value => calls.redirects.push(value) } } })
  exports.default({ liffId: '123-test' })
  const cleanup = effect()
  if (cancelled) cleanup()
  await new Promise(resolve => setImmediate(resolve))
  return calls
}

async function main() {
  const reused = await enter()
  assert.equal(reused.signIn, 0, 'same account with valid session must skip LINE sign-in')
  assert.equal(reused.session, 1, 'must revalidate session on server')
  assert.equal(reused.redirects[0], '/dashboard?view=maps')
  for (const scenario of [
    { session: null }, // expired / logged out
    { session: { user: {} } }, // revoked / inactive member
    { session: { user: { id: 'm1' } } }, // password / legacy session without LINE identity
    { sub: 'U' + 'b'.repeat(32) }, // switched LINE account
    { sub: null }, // unavailable SDK identity
    { sessionError: true },
  ]) {
    const result = await enter(scenario)
    assert.equal(result.signIn, 1, JSON.stringify(scenario))
    assert.equal(result.redirects[0], '/dashboard?view=maps')
  }
  const bulletin = await enter({ view: 'bulletin' })
  assert.equal(bulletin.signIn, 0)
  assert.equal(bulletin.session, 0)
  assert.equal(bulletin.redirects[0], '/bulletin')
  assert.equal((await enter({ loggedIn: false })).signIn, 0)
  const cancelled = await enter({ cancelled: true })
  assert.equal(cancelled.signIn, 0)
  assert.equal(cancelled.redirects.length, 0)
  assert.equal((await enter({ session: null, pending: true })).redirects[0], '/pending-access?from=liff')
  console.log('PASS: same-account reuse, session validation, expiry/logout, account changes, revoked identity, missing UID, session failure, public destination, SDK redirect, cancellation, pending access')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
