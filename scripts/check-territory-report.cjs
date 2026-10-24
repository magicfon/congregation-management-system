const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file,mocks={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>id in mocks?mocks[id]:require(id),Date,console,JSON},{filename:file}); return exports }
const taipeiDate = d => d ? d.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}) : ''
const allocation = load('src/lib/allocation.ts')
const report = load('src/lib/territory-report.ts',{'./allocation':allocation,'./google-sheets':{taipeiDate},'@prisma/client':{Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}}}})
const now = new Date('2026-10-23T12:00:00+08:00')
const tp = s => new Date(`${s}T10:00:00+08:00`)
const input = (o={}) => report.parseReportInput({sheetNos:[5],timeslot:'星期六早上',startDate:'2026-10-20',endDate:'2026-10-22',note:'',...o},now)

// 輸入防呆
assert.throws(()=>input({sheetNos:[5,214]}),/1–213/)
assert.throws(()=>input({sheetNos:[]}),/1–213/)
assert.throws(()=>input({sheetNos:Array.from({length:21},(_,i)=>i+1)}),/最多回報 20/)
assert.deepEqual([...input({sheetNos:[5,5,'6']}).sheetNos],[5,6],'去重')
assert.deepEqual([...report.parseReportInput({sheetNo:7,timeslot:'x',startDate:'2026-10-20',endDate:'2026-10-22'},now).sheetNos],[7],'相容單一 sheetNo')
assert.throws(()=>input({startDate:'2026-10-23',endDate:'2026-10-22'}),/早於開始日/)
assert.throws(()=>input({endDate:'2026-10-24'}),/晚於今天/)
assert.throws(()=>input({endDate:'2026-02-30'}),/有效/)
assert.throws(()=>input({timeslot:' '}),/時段/)
assert.equal(input({endDate:'2026-10-23',startDate:'2026-10-23'}).endDate,'2026-10-23','今天（台北）可回報')

// Sheet 列格式與公式防護
const row = report.reportSheetRow('=王',input({note:'+1'}),5,new Date('2026-10-23T03:05:09Z'))
assert.deepEqual([...row],['2026/10/23 11:05:09',"'=王",'星期六早上',5,'2026/10/20','2026/10/22',"'+1"])

// 回報了卻沒交回：同一天不算
const held = (dispatched, reported) => ({assignedMemberId:'m',dispatchedAt:tp(dispatched),completedAt:null,lastReportedCompletedAt:reported&&new Date(`${reported}T00:00:00+08:00`)})
assert.equal(report.reportedButHeld(held('2026-10-01','2026-10-02')),true)
assert.equal(report.reportedButHeld(held('2026-10-01','2026-10-01')),false)
assert.equal(report.reportedButHeld(held('2026-10-01','2026-09-30')),false)
assert.equal(report.reportedButHeld({...held('2026-10-01','2026-10-05'),completedAt:tp('2026-10-06')}),false,'已交回不列')

let state, appended, failAppend
function reset(area={}) { state={reports:[],area6:{id:'a6',sheetNo:6,assignedMemberId:null,dispatchedAt:null,completedAt:null,lastReportedCompletedAt:null},area:{id:'a5',sheetNo:5,assignedMemberId:'m1',dispatchedAt:tp('2026-10-10'),completedAt:null,lastReportedCompletedAt:new Date('2026-09-01T00:00:00+08:00'),...area}}; appended=[]; failAppend=false }
const db={$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'Serializable');const before=structuredClone(state);const tx={
 member:{findUnique:async({where})=>({id:where.id,name:where.id==='m1'?'王一':'李二',active:true,deletedAt:null}),findFirst:async({where})=>where.name==='王一'?{id:'m1',name:'王一',active:true,deletedAt:null}:null},
 area:{findUnique:async({where})=>where.sheetNo===5?{...state.area}:where.sheetNo===6?{...state.area6}:null,updateMany:async({where,data})=>{const a=state.area;const ok=a.id===where.id&&a.assignedMemberId===where.assignedMemberId&&+a.dispatchedAt===+where.dispatchedAt&&a.completedAt===where.completedAt;if(ok)Object.assign(a,data);return{count:ok?1:0}},update:async({where,data})=>Object.assign(where.id==='a6'?state.area6:state.area,data)},
 report:{findFirst:async({where})=>state.reports.find(r=>r.memberId===where.memberId&&r.content===where.content&&r.submittedAt>=where.submittedAt.gte)||null,create:async({data})=>state.reports.push(data)}}
 try{return await fn(tx)}catch(e){state=before;throw e}}}
const append=async rows=>{if(failAppend)throw new Error('sheet down');appended.push(...rows)}
;(async()=>{
 reset(); let r=await report.submitTerritoryReport(db,'m1',input(),append,now)
 assert.equal(r[0].returned,true); assert.equal(+state.area.completedAt,+now); assert.equal(taipeiDate(state.area.lastReportedCompletedAt),'2026-10-22'); assert.equal(appended.length,1); assert.equal(appended[0][1],'王一')
 assert.equal(allocation.isAreaDispatched(state.area),false,'交回後不再使用中')
 await assert.rejects(report.submitTerritoryReport(db,'m1',input(),append,now),/重複/)

 reset(); await assert.rejects(report.submitTerritoryReport(db,'m1',input({startDate:'2026-10-01',endDate:'2026-10-05'}),append,now),/早於您領取/)
 assert.equal(appended.length,0)

 reset({assignedMemberId:'m2'}); r=await report.submitTerritoryReport(db,'m1',input({startDate:'2026-10-01',endDate:'2026-10-05'}),append,now)
 assert.equal(r[0].returned,false,'他人地圖的上一輪遲交回報不交回'); assert.equal(state.area.completedAt,null); assert.equal(taipeiDate(state.area.lastReportedCompletedAt),'2026-10-05'); assert.equal(state.reports.length,1)

 reset({assignedMemberId:'m2'}); r=await report.submitTerritoryReport(db,'m1',input({startDate:'2026-10-10',endDate:'2026-10-10'}),append,now)
 assert.equal(r[0].returned,true,'結束日＝領取日也交回')

 reset({assignedMemberId:null}); r=await report.submitTerritoryReport(db,'m1',input(),append,now); assert.equal(r[0].returned,false)

 reset(); failAppend=true; await assert.rejects(report.submitTerritoryReport(db,'m1',input(),append,now),/sheet down/)
 assert.equal(state.area.completedAt,null,'Sheet 失敗整筆回滾'); assert.equal(state.reports.length,0)
 // 多區：每區一列，失敗整筆回滾
 reset(); r=await report.submitTerritoryReport(db,'m1',input({sheetNos:[5,6]}),append,now)
 assert.equal(JSON.stringify(r.map(x=>[x.sheetNo,x.returned])),"[[5,true],[6,false]]"); assert.equal(appended.length,2); assert.equal(appended.map(x=>x[3]).join(),"5,6"); assert.equal(state.reports.length,2)
 reset(); await assert.rejects(report.submitTerritoryReport(db,'m1',input({sheetNos:[5,99]}),append,now),/找不到區域號碼 99/)
 assert.equal(state.area.completedAt,null); assert.equal(state.reports.length,0); assert.equal(appended.length,0)
 // 未登入：須填姓名；對到成員照成員規則，對不到只寫 Sheet
 assert.throws(()=>report.parseReportInput({sheetNos:[5],timeslot:'x',startDate:'2026-10-20',endDate:'2026-10-22'},now,true),/姓名/)
 assert.equal(report.parseReportInput({name:'不採用',sheetNos:[5],timeslot:'x',startDate:'2026-10-20',endDate:'2026-10-22'},now).name,'','登入者不採用 body 姓名')
 const guest=o=>report.parseReportInput({sheetNos:[5],timeslot:'星期六早上',startDate:'2026-10-20',endDate:'2026-10-22',...o},now,true)
 reset(); await assert.rejects(report.submitTerritoryReport(db,null,guest({name:'王一',startDate:'2026-10-01',endDate:'2026-10-05'}),append,now),/早於您領取/)
 reset(); r=await report.submitTerritoryReport(db,null,guest({name:' 陳 三 '}),append,now)
 assert.equal(r[0].returned,true); assert.equal(state.reports.length,0,'對不到成員不留紀錄'); assert.equal(appended[0][1],'陳 三')
 reset(); r=await report.submitTerritoryReport(db,null,guest({name:'王一'}),append,now); assert.equal(state.reports[0].memberId,'m1')
 console.log('territory report checks passed')
})().catch(e=>{console.error(e);process.exit(1)})
