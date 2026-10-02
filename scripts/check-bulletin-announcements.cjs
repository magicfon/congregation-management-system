const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: id => id in mocks ? mocks[id] : require(id), Buffer, Uint8Array, Request, Response, URL, Date, console }, { filename: file });
  return exports;
}
const helpers = load('src/lib/bulletin-announcements.ts');
let role = null, rows = [], writes = 0;
const auth = { requireApiUser: async allowed => {
  assert.equal(JSON.stringify(allowed), '["admin"]');
  return role === 'admin' ? { user: { id: 'admin-id' } } : { response: new Response(null, { status: role ? 403 : 401 }) };
} };
const project = (row, select) => Object.fromEntries(Object.keys(select).map(key => [key, row[key]]));
const db = { prisma: { bulletinAnnouncement: {
  findMany: async ({ where, select }) => rows.filter(row => row.removedAt === where.removedAt).map(row => project(row, select)),
  create: async ({ data, select }) => { writes++; const row = { ...data, id: 'notice-' + writes, createdAt: new Date(), removedAt: null }; rows.unshift(row); return project(row, select); },
  findFirst: async ({ where, select }) => { const row = rows.find(row => row.id === where.id && row.removedAt === where.removedAt); return row ? project(row, select) : null; },
  updateMany: async ({ where, data }) => { const row = rows.find(row => row.id === where.id && row.removedAt === where.removedAt); if (row) Object.assign(row, data); return { count: row ? 1 : 0 }; },
} } };
const mocks = { '@/lib/api-auth': auth, '@/lib/db': db, '@/lib/bulletin-announcements': helpers };
const api = load('src/app/api/bulletin/announcements/route.ts', mocks);
const pdf = load('src/app/api/bulletin/announcements/[id]/route.ts', mocks);
const content = '%PDF-1.7\nfixture\n%%EOF';
function request(body = content, origin = 'https://example.test', type = 'application/pdf') {
  return new Request('https://example.test/api/bulletin/announcements?title=公告&filename=notice.pdf', { method: 'POST', headers: { Origin: origin, 'Content-Type': type }, body });
}
async function main() {
  assert.equal((await api.POST(request())).status, 401);
  role = 'publisher'; assert.equal((await api.POST(request())).status, 403);
  role = 'elder'; assert.equal((await api.POST(request())).status, 403);
  assert.equal(writes, 0, 'Unauthorized uploads must not write files');
  role = 'admin'; assert.equal((await api.POST(request(content, 'https://other.test'))).status, 403);
  assert.equal((await api.POST(request('<html>no pdf</html>'))).status, 400);
  assert.equal((await api.POST(request('%PDF-1.7 truncated'))).status, 400);
  assert.equal((await api.POST(request(content, 'https://example.test', 'text/html'))).status, 400);
  assert.equal((await api.POST(request('x'.repeat(helpers.MAX_ANNOUNCEMENT_BYTES + 1)))).status, 400);
  assert.equal(writes, 0, 'Invalid uploads must not create announcements');
  assert.equal((await api.POST(request())).status, 201);
  assert.equal(rows[0].uploadedBy, 'admin-id');
  assert.equal((await api.POST(request())).status, 201, 'Multiple announcements remain available');
  role = null;
  const list = await (await api.GET()).json(); assert.equal(list.length, 2);
  assert.equal('content' in list[0], false); assert.equal('uploadedBy' in list[0], false);
  const context = { params: { id: list[0].id } };
  const response = await pdf.GET(request(), context);
  assert.equal(response.status, 200); assert.equal(await response.text(), content);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-bulletin-version'), list[0].id);
  assert.equal((await pdf.DELETE(request(), context)).status, 401);
  role = 'publisher'; assert.equal((await pdf.DELETE(request(), context)).status, 403);
  role = 'admin'; assert.equal((await pdf.DELETE(request(content, 'https://other.test'), context)).status, 403);
  assert.equal((await pdf.DELETE(request(), context)).status, 204);
  assert.equal((await pdf.GET(request(), context)).status, 404, 'Removed announcements cannot be downloaded');
  assert.equal((await (await api.GET()).json()).length, 1);
  assert.equal(rows.length, 2, 'Removal preserves recoverable data');
  console.log('Announcement authorization, upload validation, public reading and removal checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
