const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: id => id in mocks ? mocks[id] : require(id), Date, console, fetch, AbortSignal, URL, Request, Response, Set, Map }, { filename: file });
  return exports;
}
const service = load('src/lib/service-roster.ts');
const importer = load('src/lib/service-roster-import.ts', { './service-roster': service });
const person = (id, roles, extra = {}) => ({ id, name: id, memberId: id, enabled: true, roles, ...extra });
const week = (startDate = '2026-10-05', assignments = {}, extra = {}) => ({ startDate, endDate: service.addDays(startDate, 6), stopped: false, note: '', assignments, ...extra });
const assignment = id => ({ personId: id, name: id });
function sourceRow(start, end, names = [], number = 1) { return { c: [number, start, '~', end, ...names].map(v => ({ v })) }; }
async function main() {
  assert.equal(service.addDays('2026-12-28', 6), '2027-01-03');
  assert.equal(service.weekLabel('2026-12-28'), '2026 W53');
  assert.equal(service.weekLabel('2027-01-04'), '2027 W1');
  assert.equal(service.validMonday('2026-10-04'), false);
  assert.equal(service.validMonday('2026-02-30'), false);
  const imported = importer.parseSourceWeeks([sourceRow('Date(2026,11,28)', 'Date(2027,0,3)'), sourceRow('Date(2027,0,4)', 'Date(2027,0,10)')]);
  assert.equal(imported.size, 2, 'Repeated week numbers across years must remain independent');
  const stopped = importer.parseSourceWeeks([sourceRow('Date(2026,9,19)', 'Date(2026,9,25)', ['沒有周中聚會 10/25 分區大會'])]).get('2026-10-19');
  assert.equal(stopped.stopped, true); assert.equal(Object.keys(stopped.names).length, 0);
  assert.throws(() => importer.parseSourceWeeks([sourceRow('9月28日', '10月4日')]), /年份/);
  const pools = importer.parsePeople([{ c: [{ v: '麥克風傳遞員 A' }, { v: '甲, 乙' }] }, { c: [null, { v: '假資格' }] }]);
  assert.equal(pools.has('假資格'), false);
  const people = [person('flex', ['micA', 'micB']), person('onlyA', ['micA']), person('stage', ['stage']), person('video', ['video']), person('audio', ['audio'])];
  const filled = service.fillServiceVacancies(week(), people, []);
  assert.equal(filled.filled, 5, 'Matching must avoid a greedy choice that leaves micB empty');
  assert.equal(filled.assignments.micA.personId, 'onlyA'); assert.equal(filled.assignments.micB.personId, 'flex');
  assert.equal(new Set(Object.values(filled.assignments).map(a => a.personId)).size, 5);
  const previous = { stage: assignment('stage'), backup: assignment('onlyA') };
  const retained = service.fillServiceVacancies(week('2026-10-05', previous), people, []);
  assert.equal(retained.assignments.stage.personId, 'stage'); assert.equal(retained.assignments.micA.personId, 'onlyA', 'Backup duty allows another role');
  const exclusion = service.fillServiceVacancies(week('2026-10-05', { host: assignment('flex') }), people, []);
  assert.equal(exclusion.assignments.micB, undefined, 'Fixed duties block equipment assignments');
  const inactive = service.fillServiceVacancies(week(), [person('inactive', service.autoRoles, { enabled: false }), person('unlinked', service.autoRoles, { memberId: null })], []);
  assert.equal(inactive.filled, 0); assert.equal(inactive.warnings.length, 5);
  assert.equal(service.fillServiceVacancies(week('2026-10-05', {}, { stopped: true }), people, []).filled, 0);
  const pool = [person('recent', ['micA']), person('fresh', ['micA'])];
  const lastWeek = [week('2026-09-28', { micB: assignment('recent') })];
  assert.equal(service.fillServiceVacancies(week(), pool, lastWeek).assignments.micA.personId, 'fresh', 'A/B share the consecutive category');
  const withoutFuture = service.fillServiceVacancies(week(), pool, lastWeek);
  const withFuture = service.fillServiceVacancies(week(), pool, [...lastWeek, week('2026-10-12', { micA: assignment('fresh') })]);
  assert.equal(JSON.stringify(withFuture.assignments), JSON.stringify(withoutFuture.assignments), 'Future arrangements must not affect earlier weeks');
  const valid = service.validateAssignments({ micA: { personId: 'onlyA', name: 'forged' } }, {}, people);
  assert.equal(valid.micA.name, 'onlyA');
  assert.throws(() => service.validateAssignments({ micB: assignment('onlyA') }, {}, people), /資格/);
  assert.throws(() => service.validateAssignments({ micA: assignment('flex'), micB: assignment('flex') }, {}, people), /重複/);
  assert.equal(service.assignmentConflicts({ watchtower: assignment('same'), reader: assignment('same') }).length, 0, 'Separate meeting duties remain compatible');
  assert.equal(service.validateAssignments({ host: assignment('original') }, { host: assignment('original') }, []).host.personId, 'original', 'Existing imported assignments remain locked until changed');

  const overview = load('src/lib/service-roster-overview.ts', { './service-roster': service });
  const overviewInput = [week('2027-01-04', { micA: assignment('one') }), week('2026-12-28', { host: assignment('one'), reader: assignment('one'), micB: assignment('two') }), week('2026-12-21', { micB: assignment('one') }), week('2027-01-11', { host: assignment('one') }, { stopped: true })];
  const personal = overview.overviewWeeks(overviewInput, '2027-01-03', 'one');
  assert.deepEqual(Array.from(personal.upcoming, w => w.startDate), ['2026-12-28', '2027-01-04'], 'Keep current Sunday, sort by full date, exclude stopped personal assignments');
  assert.equal(personal.past.length, 1);
  assert.equal(overview.overviewDuties(personal.upcoming[0], 'one').length, 2, 'Include every duty for the same person/week');
  assert.equal(overview.overviewWeeks(overviewInput, '2027-01-04', 'one').past.length, 2, 'Completed week becomes past on Monday');
  assert.equal(overview.overviewWeeks(overviewInput, '2027-01-03', 'missing').upcoming.length, 0);
  assert.equal(overview.overviewWeeks(overviewInput, '2027-01-03').upcoming.length, 3, 'All-person overview retains stopped week notices');

  let revision = 1, weeks = [week()], writes = 0;
  const database = {
    serviceRosterState: { findUnique: async () => ({ revision }), updateMany: async ({ where }) => { if (revision !== where.revision) return { count: 0 }; revision++; return { count: 1 }; } },
    servicePerson: { findMany: async () => people },
    member: { findMany: async () => people.map(p => ({ id: p.memberId })) },
    serviceWeek: { findUnique: async ({ where }) => weeks.find(w => w.startDate === where.startDate), findMany: async () => weeks, update: async ({ where, data }) => { writes++; weeks = weeks.map(w => w.startDate === where.startDate ? data : w); }, create: async ({ data }) => { writes++; weeks.push(data); } },
    $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); const before = { revision, writes, weeks: structuredClone(weeks) }; try { return await fn(database); } catch (err) { revision = before.revision; writes = before.writes; weeks = before.weeks; throw err; } },
  };
  const store = load('src/lib/service-roster-store.ts', { './service-roster': service, './service-roster-import': importer });
  await store.editServiceRoster(database, { action: 'preview', revision, startDate: '2026-10-05', assignments: {} });
  assert.equal(revision, 1); assert.equal(writes, 0, 'Preview must not publish');
  await store.editServiceRoster(database, { action: 'week', revision: 1, startDate: '2026-10-05', assignments: valid, stopped: false, note: '' });
  assert.equal(revision, 2); assert.equal(writes, 1);
  await assert.rejects(store.editServiceRoster(database, { action: 'week', revision: 1, startDate: '2026-10-05', assignments: {} }), /已更新/);
  assert.equal(writes, 1);
  await assert.rejects(store.editServiceRoster(database, { action: 'week', revision: 2, startDate: '2026-10-05', assignments: {}, stopped: true, note: '' }), /原因/);
  assert.equal(revision, 2, 'Invalid edits must roll back their revision');
  let actor = null, edited = 0;
  const auth = { requireApiUser: async roles => { assert.equal(JSON.stringify(roles), '["admin"]'); return actor === 'admin' ? { user: { id: 'admin' } } : { response: new Response(null, { status: actor ? 403 : 401 }) }; } };
  const api = load('src/app/api/service-roster/manage/route.ts', { '@/lib/api-auth': auth, '@/lib/db': { prisma: {} }, '@/lib/bulletin-announcements': { sameOrigin: req => req.headers.get('origin') === new URL(req.url).origin }, '@/lib/service-roster': service, '@/lib/service-roster-store': { RosterConflict: store.RosterConflict, editServiceRoster: async () => { edited++; return {}; }, rosterSnapshot: async () => ({}), initializeServiceRoster: async () => {} } });
  const request = (origin = 'https://test.local') => new Request('https://test.local/api/service-roster/manage', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'week' }) });
  assert.equal((await api.POST(request())).status, 401); actor = 'publisher'; assert.equal((await api.POST(request())).status, 403); actor = 'elder'; assert.equal((await api.GET()).status, 403);
  assert.equal(edited, 0); actor = 'admin'; assert.equal((await api.POST(request('https://outside.local'))).status, 403); assert.equal((await api.POST(request())).status, 200);
  let pageUser = null;
  const managementPage = load('src/app/service-roster/manage/page.tsx', {
    'next/link': { default: () => null },
    'next-auth': { getServerSession: async () => ({ user: pageUser }) },
    'next/navigation': { redirect: url => { throw new Error(`redirect:${url}`); } },
    '@/lib/auth': { authOptions: {} },
    '@/components/layout/DashboardLayout': { default: () => null },
    '@/components/bulletin/ServiceRoster': { default: () => null },
  });
  await assert.rejects(managementPage.default(), /redirect:.*login.*callbackUrl/);
  pageUser = { id: 'member', role: 'publisher' };
  await assert.rejects(managementPage.default(), /redirect:\/bulletin\/service-roster/);
  pageUser = { id: 'admin', role: 'admin' };
  assert.ok(await managementPage.default(), 'Admin can render the separate management page');
  console.log('Service roster dates, import, qualification, matching, draft, concurrency and authorization checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
