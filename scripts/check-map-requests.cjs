const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file,mocks={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>id in mocks?mocks[id]:require(id),Date,console},{filename:file}); return exports }
const allocation=load('src/lib/allocation.ts');
const dispatch=load('src/lib/batch-dispatch.ts',{'./allocation':allocation});
const service=load('src/lib/map-requests.ts',{'./allocation':allocation,'./batch-dispatch':dispatch});
let state, active=true;
function reset() { state={ requests:[], areas:Array.from({length:8},(_,i)=>({id:'a'+i,sheetNo:i+1,assignedMemberId:null,dispatchedAt:null,completedAt:null,lastReportedCompletedAt:'2026-01-01'})) }; active=true }
const db={ $transaction:async(fn,options)=>{
 assert.equal(options.isolationLevel,'Serializable'); const before=structuredClone(state);
 const tx={member:{findUnique:async({where})=>({id:where.id,name:where.id,active})},area:{findMany:async({where})=>state.areas.filter(a=>where.id.in.includes(a.id)),updateMany:async({where,data})=>{const rows=state.areas.filter(a=>where.id.in.includes(a.id));rows.forEach(a=>Object.assign(a,data));return {count:rows.length}}},mapRequest:{
 findMany:async({where})=>state.requests.filter(r=>r.memberId===where.memberId&&r.status===where.status),
 createMany:async({data})=>{data.forEach(r=>state.requests.push({...r,id:'r'+state.requests.length,status:'pending'}));return{count:data.length}},
 findUnique:async({where})=>state.requests.find(r=>r.id===where.id),
 updateMany:async({where,data})=>{const rows=state.requests.filter(r=>r.id===where.id&&r.status===where.status);rows.forEach(r=>Object.assign(r,data));return {count:rows.length}}
 }};
 try{return await fn(tx)}catch(e){state=before;throw e}
}};
(async()=>{
 reset();await service.submitMapRequests(db,'m1',['a0','a1','a2','a3']);assert.equal(state.areas[0].assignedMemberId,null,'submission must not assign');
 await assert.rejects(service.submitMapRequests(db,'m1',['a4','a5']),/最多 5/);assert.equal(state.requests.length,4);
 await assert.rejects(service.submitMapRequests(db,'m1',['a0']),/已有待審/);
 await service.submitMapRequests(db,'m1',['a4']);assert.equal(state.requests.length,5);
 await assert.rejects(service.decideMapRequest(db,'r0',{id:'m2',isAdmin:false},'cancel'),/不能/);
 await assert.rejects(service.decideMapRequest(db,'r0',{id:'m1',isAdmin:false},'approve'),/不能/);
 await service.decideMapRequest(db,'r0',{id:'m1',isAdmin:false},'cancel');assert.equal(state.requests[0].status,'cancelled');
 await service.submitMapRequests(db,'m1',['a0']);
 await service.decideMapRequest(db,'r1',{id:'admin',isAdmin:true},'approve');assert.equal(state.requests[1].status,'approved');assert.equal(state.areas[1].assignedMemberId,'m1');assert.equal(state.areas[1].lastReportedCompletedAt,'2026-01-01');
 await assert.rejects(service.decideMapRequest(db,'r1',{id:'admin',isAdmin:true},'approve'),/已處理/);
 state.areas[2].assignedMemberId='other';await assert.rejects(service.decideMapRequest(db,'r2',{id:'admin',isAdmin:true},'approve'),/已被領取/);assert.equal(state.requests[2].status,'pending','failed approval rolls back status');
 await service.decideMapRequest(db,'r2',{id:'admin',isAdmin:true},'reject');assert.equal(state.requests[2].status,'rejected');assert.equal(state.areas[2].assignedMemberId,'other');
 active=false;await assert.rejects(service.decideMapRequest(db,'r3',{id:'admin',isAdmin:true},'approve'),/停用/);assert.equal(state.requests[3].status,'pending');
 await assert.rejects(service.submitMapRequests(db,'m2',['a6']),/停用/);
 const {NextResponse}=require('next/server');let user=null,seenWhere,posted,decisions=0,complete=true,sheetFail=false;
 const auth={requireApiUser:async()=>user?{user}:{response:NextResponse.json({error:'denied'},{status:401})}};
 const api=load('src/app/api/map-requests/route.ts',{'../../../lib/api-auth':auth,'../../../lib/db':{prisma:{mapRequest:{findMany:async({where})=>{seenWhere=where;return []}}}},'../../../lib/map-requests':{...service,submitMapRequests:async(db,id,ids)=>{posted={id,ids};return{count:ids.length}}}});
 assert.equal((await api.GET()).status,401);assert.equal((await api.POST({json:async()=>({areaIds:['a0']})})).status,401);
 user={id:'m1',role:'publisher'};await api.GET();assert.equal(seenWhere.memberId,'m1');
 assert.equal((await api.POST({json:async()=>({areaIds:['a0'],memberId:'victim'})})).status,201);assert.equal(posted.id,'m1');
 assert.equal((await api.POST({json:async()=>({areaIds:['a0','a0']})})).status,400);
 assert.equal((await api.POST({json:async()=>({areaIds:['a0','a1','a2','a3','a4','a5']})})).status,400);
 const patch=load('src/app/api/map-requests/[id]/route.ts',{'../../../../lib/api-auth':auth,'../../../../lib/db':{prisma:{}},'../../../../lib/map-requests':{...service,decideMapRequest:async()=>{decisions++;return{areas:[{sheetNo:1}],member:{name:'m1'},dispatchedAt:new Date(),count:1}}},'../../../../lib/google-sheets':{readSnapshot:async()=>new Map(Array.from({length:complete?213:212},(_,i)=>[i+1,{}])),pushAreaCDBatch:async()=>{if(sheetFail)throw Error('offline')},updateSnapshot:async()=>{},DEFAULT_SHEET_ID:'test'}});
 const req={json:async()=>({action:'approve'})},ctx={params:{id:'r0'}};
 assert.equal((await patch.PATCH(req,ctx)).status,403);assert.equal(decisions,0);
 user={id:'admin',role:'admin'};complete=false;assert.equal((await patch.PATCH(req,ctx)).status,503);assert.equal(decisions,0);
 complete=true;sheetFail=true;const result=await patch.PATCH(req,ctx);assert.equal(result.status,200);assert.equal((await result.json()).sheetSynced,false);assert.equal(decisions,1);
 console.log('PASS: pending cap, duplicates, owner/admin authorization, cancellation, atomic approval rollback, completion date preservation, forged identity, full snapshot and committed Sheet failure.');
})().catch(e=>{console.error(e);process.exitCode=1});
