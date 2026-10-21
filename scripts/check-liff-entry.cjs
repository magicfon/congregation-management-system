// Server entry and rendered layout regression; no real credentials or network.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
let session = null
let sessionReads = 0
const root = path.resolve(__dirname, '..')
const mocks = {
  'next-auth': { getServerSession: async () => { sessionReads++; return session } },
  'next/navigation': { usePathname: () => '/liff', redirect: destination => { throw Object.assign(new Error('redirect'), { destination }) } },
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
}
const fileMocks = {
  'src/lib/auth.ts': { authOptions: {} },
  'src/app/liff/LiffEntry.tsx': { __esModule: true, default: () => React.createElement('p', null, 'LINE 驗證') },
  'src/components/layout/Sidebar.tsx': { __esModule: true, default: () => null },
}
const cache = new Map()
function load(file) {
  if (fileMocks[file]) return fileMocks[file]
  if (cache.has(file)) return cache.get(file)
  const exports = {}
  cache.set(file, exports)
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, { exports, process: { env: { LINE_LIFF_ID: '123-test', LINE_CLIENT_ID: '123' } }, URL, URLSearchParams,
    require: name => {
      if (mocks[name]) return mocks[name]
      if (name.startsWith('.') || name.startsWith('@/')) {
        const base = name.startsWith('@/') ? 'src/' + name.slice(2) : path.join(path.dirname(file), name)
        const source = ['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(path.join(root, candidate)))
        return load(source)
      }
      return require(name)
    },
  }, { filename: file })
  return exports
}
const Page = load('src/app/liff/page.tsx').default
const Appearance = load('src/components/layout/AppearanceProvider.tsx').default
async function destination(params) {
  try { await Page({ searchParams: params }); return null } catch (error) { if (error.destination) return error.destination; throw error }
}
async function main() {
  const failures = []
  async function check(label, run) {
    try { await run(); console.log('PASS:', label) } catch (error) { failures.push(error); console.error('FAIL:', label, error.message) }
  }
  await check('one appearance control and no bulletin header on login entry', async () => {
    const markup = renderToStaticMarkup(React.createElement(Appearance, null, await Page({ searchParams: {} })))
    assert.equal((markup.match(/aria-controls="appearance-options"/g) || []).length, 1)
    assert(!markup.includes('公布欄'))
  })
  await check('valid session redirects on server without rendering SDK/login entry', async () => {
    session = { user: { id: 'member-1' } }
    const before = sessionReads
    assert.equal(await destination({ view: 'maps' }), '/dashboard?view=maps')
    assert.equal(sessionReads - before, 1)
    assert.equal(await destination({ 'liff.state': '/?view=handoffs' }), '/dashboard?view=handoffs')
    assert.equal(await destination({ view: 'maps', 'liff.state': '?view=assignments' }), '/dashboard/assignments/service')
    assert.equal(await destination({ view: 'https://evil.test' }), '/dashboard')
    assert.equal(await destination({ 'liff.state': '//evil.test/?view=maps' }), '/dashboard')
    assert.equal(await destination({ view: ['maps', 'handoffs'] }), '/dashboard')
  })
  await check('public bulletin needs neither session nor SDK', async () => {
    session = null
    const before = sessionReads
    assert.equal(await destination({ 'liff.state': '?view=bulletin' }), '/bulletin')
    assert.equal(sessionReads, before)
  })
  await check('expired, logged-out and revoked sessions still render LINE entry', async () => {
    for (const identity of [null, { user: {} }, { user: { id: undefined } }]) {
      session = identity
      assert.equal(await destination({ view: 'maps' }), null)
    }
  })
  assert.equal(failures.length, 0, `${failures.length} LIFF entry checks failed`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
