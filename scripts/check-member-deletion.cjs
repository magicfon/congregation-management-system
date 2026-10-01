const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, mocks = {}) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, Date, require: n => mocks[n] || require(n) }); return exports; }
const allocation = load('src/lib/allocation.ts');
const { deleteMember } = load('src/lib/member-deletion.ts', { './allocation': allocation, './google-sheets': { taipeiDate: () => '2026-10-01' } });
let deleted = false, areas = [], visit = null, schedule = null, writes = [];
const tx = {
 member: { findUnique: async () => ({ id: 'm', deletedAt: deleted ? new Date() : null }), update: async q => { writes.push(q); } },
 area: { findMany: async () => areas }, ministryVisit: { findFirst: async () => visit },
 schedule: { findFirst: async q => { assert.equal(q.where.date.gte.toISOString(), '2026-09-30T16:00:00.000Z'); return schedule; } },
 mapRequest: { updateMany: async q => { assert.equal(q.where.status, 'pending'); assert.equal(q.data.status, 'cancelled'); } },
 lineNotification: { updateMany: async q => { assert.equal(q.where.status, 'pending'); assert.equal(q.data.status, 'cancelled'); } },
};
const db = { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(tx); } };
(async () => {
 await assert.rejects(deleteMember(db, 'm', 'm'), /不能刪除/);
 deleted = true; await assert.rejects(deleteMember(db, 'm', 'admin'), /不存在/); deleted = false;
 areas = [{ assignedMemberId: 'm', dispatchedAt: null, completedAt: null }]; await assert.rejects(deleteMember(db, 'm', 'admin'), /地圖/); areas = [];
 visit = {}; await assert.rejects(deleteMember(db, 'm', 'admin'), /行程/); visit = null;
 schedule = {}; await assert.rejects(deleteMember(db, 'm', 'admin'), /行程/); schedule = null;
 assert.equal(writes.length, 0);
 await deleteMember(db, 'm', 'admin');
 assert.equal(writes.length, 1); const data = writes[0].data;
 assert.equal(data.lineuid, null); assert.equal(data.active, false); assert(data.deletedAt);
 assert.equal(data.name, undefined); assert.equal(data.email, 'deleted-m@deleted.invalid');
 console.log('PASS: self deletion, absent member, assignments, unfinished schedules, Taipei date, retained historical row, released LINE identity, cancelled pending work.');
})().catch(e => { console.error(e); process.exitCode = 1; });
