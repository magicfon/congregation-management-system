// Isolated API tests: no live database or Sheet writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>id in mocks?mocks[id]:require(id),Date,console});return exports;}
(async()=>{
 const {NextResponse}=require('next/server');let role=null,reads=0,writes=0,sheetReads=0,failSheet=false;
 const area={id:'a58',sheetNo:58,name:'58',dispatchEnabled:true,assignedMemberId:'holder',dispatchedAt:'2026-08-01',lastReportedCompletedAt:'2026-07-01',reports:[],_count:{reports:0}};
 const auth={requireApiUser:async(roles)=>{assert.equal(roles.join(','),'admin');return role==='admin'?{user:{id:'admin',role}}:{response:NextResponse.json({error:'denied'},{status:role?403:401})}}};
 const api=load('src/app/api/areas/[id]/properties/route.ts',{'../../../../../lib/api-auth':auth,'../../../../../lib/db':{prisma:{area:{findUnique:async()=>{reads++;return {...area}},updateMany:async({where,data})=>{writes++;assert.equal(Object.keys(data).join(','),'dispatchEnabled');assert.equal(where.id,'a58');if(where.dispatchEnabled!==area.dispatchEnabled)return{count:0};area.dispatchEnabled=data.dispatchEnabled;return{count:1}}}}},'../../../../../lib/google-sheets':{DEFAULT_SHEET_ID:'test',readValues:async(id,range)=>{sheetReads++;assert.equal(range,'傳道區域回報!A2:G');if(failSheet)throw Error('offline');return [['old','A','','58','','2026/1/1'],['other','B','','59','','2026/3/1'],['new','C','','58','','2026/9/1']]}}});
 const ctx={params:{id:'a58'}},patch=body=>api.PATCH({json:async()=>body},ctx);
 assert.equal((await api.GET({},ctx)).status,401);assert.equal((await patch({dispatchEnabled:false,expectedEnabled:true})).status,401);
 role='publisher';assert.equal((await api.GET({},ctx)).status,403);assert.equal((await patch({dispatchEnabled:false,expectedEnabled:true})).status,403);assert.equal(reads+writes+sheetReads,0);
 role='admin';const history=await(await api.GET({},ctx)).json();assert.equal(history.formReports.length,2);assert.equal(history.formReports[0].memberName,'C');assert.equal(history.formReports[1].completedDate,'2026/1/1');assert.equal(history.sheetError,null);
 failSheet=true;const partial=await(await api.GET({},ctx)).json();assert(partial.sheetError);assert.equal(partial.reports.length,0);
 assert.equal((await patch({dispatchEnabled:'false',expectedEnabled:true})).status,400);assert.equal(writes,0);
 assert.equal((await patch({dispatchEnabled:false,expectedEnabled:true,assignedMemberId:null})).status,200);assert.equal(area.dispatchEnabled,false);assert.equal(area.assignedMemberId,'holder');assert.equal(area.dispatchedAt,'2026-08-01');assert.equal(area.lastReportedCompletedAt,'2026-07-01');
 assert.equal((await patch({dispatchEnabled:true,expectedEnabled:true})).status,409);assert.equal(area.dispatchEnabled,false);
 assert.equal((await patch({dispatchEnabled:true,expectedEnabled:false})).status,200);
 const allocation=load('src/lib/allocation.ts'),dispatch=load('src/lib/batch-dispatch.ts',{'./allocation':allocation});let allocated=false;
 const db={$transaction:async(fn)=>fn({member:{findUnique:async()=>({active:true,id:'m',name:'m'})},area:{findMany:async()=>[{id:'a58',dispatchEnabled:false}],updateMany:async()=>{allocated=true;return{count:1}}}})};
 await assert.rejects(dispatch.batchDispatch(db,['a58'],'m',null),/暫停/);assert.equal(allocated,false);
 let legacyUpdate=false;const legacy=load('src/app/api/areas/assign/route.ts',{'../../../../lib/api-auth':auth,'../../../../lib/db':{prisma:{area:{findUnique:async()=>({dispatchEnabled:false}),update:async()=>{legacyUpdate=true}}}},'../../../../lib/google-sheets':{}});
 assert.equal((await legacy.POST({json:async()=>({areaId:'a58',memberId:'m'})})).status,409);assert.equal(legacyUpdate,false);
 console.log('PASS: admin-only properties/history, correct Sheet area matching, explicit Sheet failure, strict boolean/CAS, holder/date preservation, paused batch and legacy dispatch rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
