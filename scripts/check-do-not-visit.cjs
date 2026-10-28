// 拒絕拜訪 J 欄雙向同步（ADR-0086）；只用記憶體假資料，不連 DB 與 Sheet。
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
function load(file, mocks = {}) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: id => id in mocks ? mocks[id] : require(id), console, JSON }, { filename: file }); return exports }
const list = load('src/lib/do-not-visit-list.ts')
let pushed = []
const dnv = load('src/lib/do-not-visit.ts', { './do-not-visit-list': list, './google-sheets': { sheetRow: no => no + 1, DEFAULT_SHEET_ID: 'sheet', batchUpdate: async (_id, data) => { pushed.push(...data) } } })

// 文字處理
assert.deepEqual([...list.doNotVisitList('忠義六巷16號,忠義七巷8號\n聖公路32號 有凶狗，不要靠近')], ['忠義六巷16號', '忠義七巷8號', '聖公路32號 有凶狗，不要靠近'], '換行與半形逗號分隔，全形標點不切')
assert.equal(list.normalizeDoNotVisit(' a \r\n\r\n b '), 'a\nb')
assert.equal(list.mergeDoNotVisit('a,b', 'b\nc'), 'a,b\nc', '合併保留原格式，只接上新地址')
assert.equal(list.mergeDoNotVisit('', 'x'), 'x')

function db(areas, snapshot) {
  const settings = new Map(snapshot ? [['sheet_j_snapshot', JSON.stringify(snapshot)]] : [])
  return {
    areas,
    setting: { findUnique: async ({ where }) => settings.has(where.key) ? { value: settings.get(where.key) } : null, upsert: async ({ where, create }) => { settings.set(where.key, create.value) } },
    area: { findMany: async () => areas.map(a => ({ ...a })), update: ({ where, data }) => { Object.assign(areas.find(a => a.id === where.id), data) } },
    $transaction: async ops => ops,
    snapshot: () => JSON.parse(settings.get('sheet_j_snapshot')),
  }
}
const rows = j => j.map((text, i) => { const row = [String(i + 1), '', '', '', '', '', '', '']; if (text !== undefined) row.push(text); return row })

;(async () => {
  // 第一次：以 Sheet 為準匯入，快照涵蓋所有讀到的區
  let d = db([{ id: 'a1', sheetNo: 1, doNotVisit: '' }, { id: 'a2', sheetNo: 2, doNotVisit: '' }, { id: 'a3', sheetNo: 3, doNotVisit: '' }])
  pushed = []
  let r = await dnv.syncDoNotVisit(d, rows(['加昌路279巷5號', undefined, 'x,y']))
  assert.deepEqual({ ...r }, { imported: 2, pushed: 0, conflicts: 0 })
  assert.equal(d.areas[0].doNotVisit, '加昌路279巷5號'); assert.equal(d.areas[2].doNotVisit, 'x,y'); assert.equal(pushed.length, 0)
  assert.deepEqual(d.snapshot(), { 1: '加昌路279巷5號', 2: '', 3: 'x,y' })
  // 第二次：全零
  r = await dnv.syncDoNotVisit(d, rows(['加昌路279巷5號', undefined, 'x,y']))
  assert.deepEqual({ ...r }, { imported: 0, pushed: 0, conflicts: 0 }, '第二次同步必須全零')
  // 只改 Sheet → 匯入
  r = await dnv.syncDoNotVisit(d, rows(['', 'b', 'x,y']))
  assert.deepEqual({ ...r }, { imported: 2, pushed: 0, conflicts: 0 }); assert.equal(d.areas[0].doNotVisit, ''); assert.equal(d.areas[1].doNotVisit, 'b')
  // 只改系統（寫回失敗的情況）→ 補寫 Sheet
  d.areas[0].doNotVisit = 'c'; pushed = []
  r = await dnv.syncDoNotVisit(d, rows(['', 'b', 'x,y']))
  assert.deepEqual({ ...r }, { imported: 0, pushed: 1, conflicts: 0 }); assert.deepEqual(pushed.map(p => [p.range, p.values[0][0]]), [['區域狀態!J2', 'c']])
  assert.equal(d.snapshot()[1], 'c')
  // 兩邊都改 → 合併寫回兩邊
  d.areas[1].doNotVisit = 'b\nd'; pushed = []
  r = await dnv.syncDoNotVisit(d, rows(['c', 'b\ne', 'x,y']))
  assert.deepEqual({ ...r }, { imported: 0, pushed: 1, conflicts: 1 }); assert.equal(d.areas[1].doNotVisit, 'b\ne\nd'); assert.equal(pushed[0].values[0][0], 'b\ne\nd'); assert.equal(d.snapshot()[2], 'b\ne\nd')
  console.log('do-not-visit checks passed')
})().catch(error => { console.error(error); process.exit(1) })
