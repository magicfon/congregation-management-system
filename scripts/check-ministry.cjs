// In-memory transactions only; never writes to Neon or Google Sheet.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,console,Date,require:n=>mocks[n]??require(n)});return exports}
const allocation=load('src/lib/allocation.ts');const M=load('src/lib/ministry.ts',{'./allocation':allocation});
let state={area:{id:'a',assignedMemberId:'manager',dispatchedAt:new Date('2026-09-01'),completedAt:null,lastReportedCompletedAt:new Date('2026-08-01'),ministryRevision:0,sheetNo:10},visits:[],reports:[]};
const matches=(row,where)=>Object.entries(where).every(([k,v])=>v&&typeof v==='object'&&'in'in v?v.in.includes(row[k]):row[k]===v);
const db={$transaction:async fn=>{const copy=structuredClone(state);const tx={member:{findUnique:async({where})=>['manager','p1','p2','admin'].includes(where.id)?{id:where.id,name:where.id,active:true}:null},area:{findUnique:async()=>copy.area,update:async({data})=>Object.assign(copy.area,data),updateMany:async({where,data})=>{if(!matches(copy.area,where))return{count:0};copy.area.ministryRevision+=data.ministryRevision.increment;return{count:1}}},ministryVisit:{findFirst:async({where})=>copy.visits.find(v=>matches(v,where))||null,create:async({data})=>{const v={id:'v'+(copy.visits.length+1),status:'planned',strokes:[],note:'',...data};copy.visits.push(v);return v},update:async({where,data})=>Object.assign(copy.visits.find(v=>matches(v,where)),data),updateMany:async({where,data})=>{const rows=copy.visits.filter(v=>matches(v,where));rows.forEach(v=>Object.assign(v,data));return{count:rows.length}}},report:{create:async({data})=>copy.reports.push(data)}};const result=await fn(tx);state=copy;return result}};
const actor=id=>({id,isAdmin:id==='admin'});const cmd=(action,extra={})=>({action,cycleKey:M.ministryCycle(state.area),expectedRevision:state.area.ministryRevision,...extra});const call=(id,command)=>M.changeMinistry(db,'a',actor(id),command,new Date('2026-09-30T05:00:00Z'));
(async()=>{
 assert(M.validMinistryDate('2026-09-30'));assert(!M.validMinistryDate('2026-02-30'));
 assert.throws(()=>M.validateStrokes([{width:.02,points:[[1.1,0]]}]));assert.throws(()=>M.validateStrokes([{width:NaN,points:[[0,0]]}]));assert.throws(()=>M.validateStrokes(Array(201).fill({width:.01,points:[[0,0]]})));
 await assert.rejects(()=>call('p1',cmd('plan',{publisherId:'p1',scheduledDate:'2026-10-01'})),/管理者/);
 await call('manager',cmd('plan',{publisherId:'p1',scheduledDate:'2026-10-01'}));
 await call('manager',cmd('plan',{publisherId:'p2',scheduledDate:'2026-10-02'}));
 await assert.rejects(()=>call('manager',cmd('plan',{publisherId:'p2',scheduledDate:'2026-10-02'})),/已安排/);
 await call('manager',cmd('start',{visitId:'v1'}));
 await assert.rejects(()=>call('manager',cmd('start',{visitId:'v2'})),/仍有人/);
 await assert.rejects(()=>call('manager',cmd('finish')),/進行中/);
 const strokes=[{width:.015,points:[[.2,.3],[.3,.4]]}];
 await assert.rejects(()=>call('p2',cmd('save',{visitId:'v1',strokes,note:''})),/被指派/);
 const stale=cmd('save',{visitId:'v1',strokes,note:'saved'});await call('p1',stale);await assert.rejects(()=>call('p1',stale),/其他裝置/);
 assert.equal(state.area.completedAt,null);assert.equal(state.area.dispatchedAt.toISOString(),'2026-09-01T00:00:00.000Z');
 await call('p1',cmd('submit',{visitId:'v1',strokes,note:'next street'}));assert.equal(state.visits[0].status,'submitted');assert.equal(state.visits[0].publisherName,'p1');
 await assert.rejects(()=>call('p1',cmd('save',{visitId:'v1',strokes,note:'overwrite'})),/被指派/);
 await assert.rejects(()=>call('p1',cmd('finish')),/管理者/);
 const originalCycle=M.ministryCycle(state.area);state.area.dispatchedAt=new Date('2026-09-29');await assert.rejects(()=>call('manager',{...cmd('start',{visitId:'v2'}),cycleKey:originalCycle}),/重新分發/);state.area.dispatchedAt=new Date('2026-09-01');
 await call('manager',cmd('finish'));assert.equal(state.visits[1].status,'cancelled');assert.equal(state.reports.length,1);assert.equal(state.area.lastReportedCompletedAt.toISOString(),'2026-08-01T00:00:00.000Z');assert(state.area.completedAt);await assert.rejects(()=>call('p1',cmd('submit',{visitId:'v1',strokes,note:''})),/交回/);
 console.log('PASS: manager/publisher isolation, date/stroke bounds, duplicate plans, one active visit, revision conflicts, submitted immutability, old-cycle rejection, finish cancels plans without resetting dispatch or form completion dates.');
})().catch(e=>{console.error(e);process.exitCode=1});
