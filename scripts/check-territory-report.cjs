const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file,mocks={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>id in mocks?mocks[id]:require(id),Date,console,JSON},{filename:file}); return exports }
const taipeiDate = d => d ? d.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}) : ''
const allocation = load('src/lib/allocation.ts')
const report = load('src/lib/territory-report.ts',{'./allocation':allocation,'./google-sheets':{taipeiDate},'@prisma/client':{Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}}}})
const now = new Date('2026-10-23T12:00:00+08:00')
const tp = s => new Date(`${s}T10:00:00+08:00`)
const input = (o={}) => report.parseReportInput({sheetNo:5,timeslot:'星期六早上',startDate:'2026-10-20',endDate:'2026-10-22',note:'',...o},now)

// 輸入防呆
assert.throws(()=>input({sheetNo:214}),/1–213/)
assert.throws(()=>input({startDate:'2026-10-23',endDate:'2026-10-22'}),/早於開始日/)
assert.throws(()=>input({endDate:'2026-10-24'}),/晚於今天/)
assert.throws(()=>input({endDate:'2026-02-30'}),/有效/)
assert.throws(()=>input({timeslot:' '}),/時段/)
assert.equal(input({endDate:'2026-10-23',startDate:'2026-10-23'}).endDate,'2026-10-23','今天（台北）可回報')

// Sheet 列格式與公式防護
const row = report.reportSheetRow('=王',input({note:'+1'}),new Date('2026-10-23T03:05:09Z'))
assert.deepEqual([...row],['2026/10/23 11:05:09',"'=王",'星期六早上',5,'2026/10/20','2026/10/22',"'+1"])

// 回報了卻沒交回：同一天不算
const held = (dispatched, reported) => ({assignedMemberId:'m',dispatchedAt:tp(dispatched),completedAt:null,lastReportedCompletedAt:reported&&new Date(`${reported}T00:00:00+08:00`)})
assert.equal(report.reportedButHeld(held('2026-10-01','2026-10-02')),true)
assert.equal(report.reportedButHeld(held('2026-10-01','2026-10-01')),false)
assert.equal(report.reportedButHeld(held('2026-10-01','2026-09-30')),false)
assert.equal(report.reportedButHeld({...held('2026-10-01','2026-10-05'),completedAt:tp('2026-10-06')}),false,'已交回不列')

let state, appended, failAppend
function reset(area={}) { state={reports:[],area:{id:'a5',sheetNo:5,assignedMemberId:'m1',dispatchedAt:tp('2026-10-10'),completedAt:null,lastReportedCompletedAt:new Date('2026-09-01T00:00:00+08:00'),...area}}; appended=[]; failAppend=false }
const db={$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'Serializable');const before=structuredClone(state);const tx={
 member:{findUnique:async({where})=>({name:where.id==='m1'?'王一':'李二',active:true,deletedAt:null})},
 area:{findUnique:async({where})=>where.sheetNo===5?{...state.area}:null,updateMany:async({where,data})=>{const a=state.area;const ok=a.id===where.id&&a.assignedMemberId===where.assignedMemberId&&+a.dispatchedAt===+where.dispatchedAt&&a.completedAt===where.completedAt;if(ok)Object.assign(a,data);return{count:ok?1:0}},update:async({data})=>Object.assign(state.area,data)},
 report:{findFirst:async({where})=>state.reports.find(r=>r.memberId===where.memberId&&r.content===where.content&&r.submittedAt>=where.submittedAt.gte)||null,create:async({data})=>state.reports.push(data)}}
 try{return await fn(tx)}catch(e){state=before;throw e}}}
const append=async r=>{if(failAppend)throw new Error('sheet down');appended.push(r)}
;(async()=>{
 reset(); let r=await report.submitTerritoryReport(db,'m1',input(),append,now)
 assert.equal(r.returned,true); assert.equal(+state.area.completedAt,+now); assert.equal(taipeiDate(state.area.lastReportedCompletedAt),'2026-10-22'); assert.equal(appended.length,1); assert.equal(appended[0][1],'王一')
 assert.equal(allocation.isAreaDispatched(state.area),false,'交回後不再使用中')
 await assert.rejects(report.submitTerritoryReport(db,'m1',input(),append,now),/重複/)

 reset(); await assert.rejects(report.submitTerritoryReport(db,'m1',input({startDate:'2026-10-01',endDate:'2026-10-05'}),append,now),/早於您領取/)
 assert.equal(appended.length,0)

 reset({assignedMemberId:'m2'}); r=await report.submitTerritoryReport(db,'m1',input({startDate:'2026-10-01',endDate:'2026-10-05'}),append,now)
 assert.equal(r.returned,false,'他人地圖的上一輪遲交回報不交回'); assert.equal(state.area.completedAt,null); assert.equal(taipeiDate(state.area.lastReportedCompletedAt),'2026-10-05'); assert.equal(state.reports.length,1)

 reset({assignedMemberId:'m2'}); r=await report.submitTerritoryReport(db,'m1',input({startDate:'2026-10-10',endDate:'2026-10-10'}),append,now)
 assert.equal(r.returned,true,'結束日＝領取日也交回')

 reset({assignedMemberId:null}); r=await report.submitTerritoryReport(db,'m1',input(),append,now); assert.equal(r.returned,false)

 reset(); failAppend=true; await assert.rejects(report.submitTerritoryReport(db,'m1',input(),append,now),/sheet down/)
 assert.equal(state.area.completedAt,null,'Sheet 失敗整筆回滾'); assert.equal(state.reports.length,0)
 console.log('territory report checks passed')
})().catch(e=>{console.error(e);process.exit(1)})
