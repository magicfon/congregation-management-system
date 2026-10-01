// Read-only fixtures: no live DB or notifications.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Date,process,require:n=>mocks[n]??require(n)});return exports}
const allocation=load('src/lib/allocation.ts'),dates=load('src/lib/google-sheets.ts');
const ministry=load('src/lib/ministry.ts',{'./allocation':allocation,'./line-notifications':{},'./line-bot-client':{}});
const handoffs=load('src/lib/ministry-handoffs.ts',{'./allocation':allocation,'./ministry':ministry,'./google-sheets':dates});
const tasks=load('src/lib/admin-tasks.ts',{'./allocation':allocation,'./ministry-handoffs':handoffs,'./google-sheets':dates});
const date=new Date('2026-10-01T16:30:00Z');
const base={id:'a',name:'map',mapId:'nanzih',mapAreaId:1,sheetNo:1,assignedMemberId:'manager',assignedMember:{name:'地圖管理者'},dispatchedAt:new Date('2026-09-01'),completedAt:null};
const cycle=ministry.ministryCycle(base);
const submitted={cycleKey:cycle,status:'submitted',publisherName:'提交者',scheduledDate:'2026-10-01',submittedAt:date};
const planned={cycleKey:cycle,status:'planned',publisherName:'下一位',scheduledDate:'2026-10-03',submittedAt:null};
const areas=[
 {...base,ministryVisits:[submitted,planned,{...planned,scheduledDate:'2026-10-04',publisherName:'更晚'}]},
 {...base,id:'active',ministryVisits:[submitted,{...planned,status:'active'}]},
 {...base,id:'returned',completedAt:new Date('2026-09-30'),ministryVisits:[submitted]},
 {...base,id:'old-cycle',ministryVisits:[{...submitted,cycleKey:'old'}]},
 {...base,id:'plans-only',ministryVisits:[planned]},
 {...base,id:'unassigned',assignedMemberId:null,ministryVisits:[submitted]},
 {...base,id:'no-next',ministryVisits:[submitted,{...submitted,submittedAt:new Date('2026-09-02'),publisherName:'較早'}, {...planned,status:'cancelled'}]},
];
let reads=0,fail=false;
const db={pendingLineIdentity:{count:async()=>6,findMany:async q=>{reads++;assert.equal(q.take,5);assert.equal(q.select.uid,undefined);return [{displayName:'待確認',createdAt:date,uid:'must-not-leak'},{displayName:null,createdAt:date}]}},mapRequest:{count:async q=>{assert.equal(q.where.status,'pending');return 8},findMany:async q=>{assert.equal(q.where.status,'pending');assert.equal(q.take,5);return[{id:'r',createdAt:date,member:{name:'申請人'},area:base}]}},area:{findMany:async q=>{assert.equal(q.where.assignedMemberId.not,null);assert.equal(q.select.ministryVisits.select.strokes,undefined);if(fail)throw Error('DB unavailable');return areas}}};
let role='publisher',signed=true;
const route=load('src/app/api/admin/tasks/route.ts',{'../../../../lib/db':{prisma:db},'../../../../lib/admin-tasks':tasks,'../../../../lib/api-auth':{requireApiUser:async roles=>{assert.equal(roles[0],'admin');return !signed?{response:new Response(null,{status:401})}:role!=='admin'?{response:new Response(null,{status:403})}:{user:{id:'admin',role}}}}});
(async()=>{
 assert.equal((await route.GET()).status,403);assert.equal(reads,0);role='elder';assert.equal((await route.GET()).status,403);assert.equal(reads,0);
 signed=false;assert.equal((await route.GET()).status,401);signed=true;role='admin';
 const res=await route.GET(),data=await res.json();assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
 assert.equal(data.line.count,6);assert.equal(data.requests.count,8);assert.equal(data.line.items[0].date,'2026-10-02');assert.equal(data.requests.items[0].date,'2026-10-02');assert.equal(data.line.items[1].name,'尚未取得 LINE 顯示名稱');assert(!JSON.stringify(data).includes('must-not-leak'));
 assert.equal(data.handoffs.count,2);assert.equal(data.handoffs.items[0].manager,'地圖管理者');assert.equal(data.handoffs.items[0].next.name,'下一位');assert.equal(data.handoffs.items[1].next,null);assert.equal(data.handoffs.items[1].publisher,'提交者');
 fail=true;assert.equal((await route.GET()).status,503);
 console.log('PASS: admin-only access without unauthorized DB reads, totals vs previews, Taipei dates, minimal private fields, all-member current-cycle handoffs, excluded active/returned/old/planned-only/unassigned, next visit, DB errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
