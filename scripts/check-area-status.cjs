// Isolated checks: no credentials, live Sheet reads, or database writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,require:id=>id in mocks?mocks[id]:require(id),console,process,Date,URL,Buffer},{filename:file});return exports;}
(async()=>{
 const allocation=load('src/lib/allocation.ts'),dates=load('src/lib/google-sheets.ts');
 const heat=load('src/lib/area-status.ts',{'./allocation':allocation});
 assert.equal(heat.heatColor(0,180),'#22c55e');assert.equal(heat.heatColor(90,180),'#facc15');assert.equal(heat.heatColor(180,180),'#ef4444');assert.equal(heat.heatColor(999,180),'#ef4444');assert.equal(heat.heatColor(null,180),'#64748b');assert.notEqual(heat.heatColor(45,180),heat.heatColor(0,180));assert.notEqual(heat.heatColor(135,180),heat.heatColor(90,180));
 assert.equal(heat.heatColor(0,600),'#22c55e');assert.equal(heat.heatColor(300,600),'#facc15');assert.equal(heat.heatColor(600,600),'#ef4444');assert.notEqual(heat.heatColor(180,600),'#ef4444');assert.equal(heat.heatColor(0,0),'#22c55e');assert.equal(heat.heatColor(0,null),'#64748b');
 const today='2026-09-26',areas=[{sheetNo:90,name:'橋頭 90',lastCompletedDate:'2026-09-25',mapAreaId:1},{sheetNo:91,name:'橋頭 91',lastCompletedDate:'2026-03-30'}];
 assert.equal(heat.maximumReportDays(areas,today),180);assert.equal(heat.maximumReportDays([],today),null);assert.equal(heat.maximumReportDays([{lastCompletedDate:'2026-09-27'}],today),null);assert.equal(heat.maximumReportDays([{lastCompletedDate:today}],today),0);
 assert.equal(heat.regionHeat([90],areas,today,true).days,1);assert.equal(heat.regionHeat([1],areas,today,true).status,'incomplete','不可拿 local mapAreaId 當全域編號');
 assert.equal(heat.regionHeat([90,91],areas,today,true).days,180);assert.equal(heat.regionHeat([90,91],areas,today,false).status,'unsynced');
 assert.equal(heat.regionHeat([],areas,today,true).status,'unmatched');assert.equal(heat.regionHeat([90], [{...areas[0],lastCompletedDate:null}],today,true).status,'no-report');assert.equal(heat.regionHeat([90,92],areas,today,true).days,null);
 assert.equal(heat.regionHeat([90],[{...areas[0],lastCompletedDate:'2026-09-27'}],today,true).days,null);
 assert.equal(allocation.idleCalendarDays(dates.taipeiDate(new Date('2026-09-25T15:59:00Z')),dates.taipeiDate(new Date('2026-09-25T16:01:00Z'))),1);
 const G=require('../public/tools/boundary-editor/geometry.js'),originals=Object.fromEntries(['nanzih','chiaotou','tzuguan'].map(id=>[id,require('../public/maps/reconstruction-v1/'+id+'.json')]));
 const boundary=load('src/lib/boundary-drafts.ts',{'../../public/tools/boundary-editor/geometry':G,...Object.fromEntries(Object.entries(originals).map(([id,d])=>['../../public/maps/reconstruction-v1/'+id+'.json',d]))});
 const {NextResponse}=require('next/server');let signedIn=false,fail=false,draft=null,queryCount=0;
 const route=load('src/app/api/area-status/[mapId]/route.ts',{
  '../../../../lib/api-auth':{requireApiUser:async()=>signedIn?{user:{role:'publisher'}}:{response:NextResponse.json({error:'denied'},{status:401})}},
  '../../../../lib/boundary-drafts':boundary,'../../../../lib/area-status':heat,'../../../../lib/google-sheets':dates,'../../../../lib/report-completion-sync':{COMPLETION_SYNC_KEY:'test'},
  '../../../../lib/db':{prisma:{$queryRaw:async(strings,...values)=>{assert(strings.join('').startsWith('SELECT'));assert(['nanzih','chiaotou','tzuguan'].includes(values[0]));queryCount++;if(fail)throw Error('offline');return draft?[draft]:[]},area:{findMany:async query=>{assert.deepEqual(JSON.parse(JSON.stringify(query.select)),{mapId:true,sheetNo:true,name:true,lastReportedCompletedAt:true});assert.deepEqual(Array.from(query.where.mapId.in),['nanzih','chiaotou','tzuguan']);return [{mapId:'nanzih',sheetNo:58,name:'58',lastReportedCompletedAt:new Date('2026-01-01T00:00:00Z')},{mapId:'nanzih',sheetNo:999,name:'unlocated',lastReportedCompletedAt:null},{mapId:'tzuguan',sheetNo:150,name:'150',lastReportedCompletedAt:new Date('2025-01-01T00:00:00Z')}]}},setting:{findUnique:async()=>({value:'2026-09-26T00:00:00Z'})}}},
 });
 const context={params:{mapId:'nanzih'}};
 assert.equal((await route.GET({},context)).status,401);assert.equal(queryCount,0);signedIn=true;
 assert.equal((await route.GET({},{params:{mapId:'unknown'}})).status,404);
 const originalResponse=await (await route.GET({},context)).json();assert.equal(originalResponse.boundary.source,'original');const globalMax=allocation.idleCalendarDays('2025-01-01',originalResponse.today);assert.equal(originalResponse.scaleMaxDays,globalMax);assert.notEqual(originalResponse.regions.find(r=>r.numbers.length===1&&r.numbers[0]===58).color,'#ef4444');assert(!originalResponse.unlocatedNumbers.includes(150));assert(originalResponse.unlocatedNumbers.includes(999));assert(originalResponse.regions.some(r=>r.numbers.includes(58)&&r.days>=180));
 const otherMap=await (await route.GET({},{params:{mapId:'tzuguan'}})).json();assert.equal(otherMap.scaleMaxDays,globalMax,'切換地圖仍使用同一個全區最大值');
 const saved=G.independentBlocks(originals.nanzih);saved.candidates=saved.candidates.filter(c=>c.numberCandidates.includes(58));draft={document:saved,version:7,updatedAt:new Date()};
 const cloud=await (await route.GET({},context)).json();assert.equal(cloud.boundary.source,'cloud');assert.equal(cloud.boundary.version,7);assert.equal(cloud.scaleMaxDays,globalMax);assert.equal(cloud.regions.length,saved.candidates.length);
 draft={...draft,document:{...saved,sourceSha256:'wrong'}};assert.equal((await route.GET({},context)).status,503,'無效雲端草稿不得冒充原始候選');fail=true;assert.equal((await route.GET({},context)).status,503);
 console.log('PASS: continuous colors, Taipei dates, completion-only fields, global numbering, unknown/multiple regions, publisher access, cloud priority and explicit failure.');
})().catch(e=>{console.error(e);process.exitCode=1});
