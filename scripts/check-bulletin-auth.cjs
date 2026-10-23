const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
async function scenario(initial, updated, pathname = '/bulletin/service-roster/all') {
  let response = initial, cursor = 0;
  const state = [], effects = [], listeners = new Map();
  const react = { ...React, useState(value) { const index = cursor++; if (!(index in state)) state[index] = value; return [state[index], value => { state[index] = value; }]; }, useEffect(effect) { effects.push(effect); } };
  const exports = {};
  const mocks = { react, 'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) }, 'next/navigation': { usePathname: () => pathname }, '@/components/layout/AppearanceProvider': { AppearanceControl: () => React.createElement('button', null, '外觀') } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/bulletin/BulletinLayout.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: id => mocks[id] ?? require(id), AbortController,
    localStorage: { getItem: () => null }, document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    window: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) },
    fetch: async () => ({ ok: response !== null, status: response === null ? 401 : 200, json: async () => response }),
  });
  const render = () => { cursor = 0; return renderToStaticMarkup(exports.default({ children: '內容' })); };
  render(); const cleanup = effects.map(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  let html = render();
  if (initial) assert.ok(!html.includes('>登入</a>'), '已登入仍顯示登入按鈕');
  else assert.ok(html.includes('>登入</a>'), '訪客缺少登入入口');
  if (initial) {
    assert.match(html, /href="\/dashboard"[^>]*>我的看板<\/a>/, '登入後應提供名稱一致的看板入口');
    assert.ok(!html.includes('href="/service-roster/manage"'), '共用標頭不應重複提供安排入口或連回管理頁自身');
  }
  if (updated !== undefined) {
    response = updated; await listeners.get('focus')?.();
    await new Promise(resolve => setImmediate(resolve)); html = render();
    assert.equal(html.includes('>登入</a>'), updated === null, '切換視窗後登入狀態未更新');
  }
  cleanup.forEach(fn => fn?.());
}
(async () => {
  await scenario({ id: 'admin-fixture', role: 'admin' }, null);
  await scenario({ id: 'member-fixture', role: 'publisher' });
  await scenario(null, { id: 'admin-fixture', role: 'admin' });
  await scenario({ id: 'admin-fixture', role: 'admin' }, undefined, '/service-roster/manage');
  await scenario({ id: 'member-fixture', role: 'publisher' }, undefined, '/map-images');
  console.log('Bulletin header authenticated, guest, admin and focus refresh checks passed');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
