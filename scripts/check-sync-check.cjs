const assert = require('node:assert/strict'), fs = require('fs'), vm = require('vm'), ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/sync-check.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject });
const { checkSync } = exportsObject;
const zero = { ok: true, errors: [], completionDatesUpdated: 0, imported: 0, sheetEdits: 0, conflicts: 0, pushedBack: 0 };
async function scenario(values, expected, rejects = false) {
  let calls = 0, results = [];
  const run = () => checkSync(async () => { const value = values[calls++]; if (value instanceof Error) throw value; return value; }, r => results.push(r));
  if (rejects) await assert.rejects(run); else assert.equal(await run(), expected);
  assert.equal(calls, values.length);
  return results;
}
(async () => {
  await scenario([{ ...zero, imported: 3 }, zero], true);
  await scenario([zero, { ...zero, sheetEdits: 1 }], false);
  await scenario([{ ...zero, conflicts: 1 }], null, true);
  await scenario([{ ...zero, errors: ['partial failure'] }], null, true);
  await scenario([{ ...zero, ok: false, error: 'server failure' }], null, true);
  await scenario([{ ok: true }], null, true);
  await scenario([{ ...zero, pushedBack: -1 }], null, true);
  const retained = await scenario([zero, new Error('network failure')], null, true);
  assert.equal(retained.length, 1);
  console.log('PASS: sequential two runs, zero-change verification, stop on conflict/errors/malformed response, retain first result after network failure.');
})().catch(e => { console.error(e); process.exitCode = 1; });
