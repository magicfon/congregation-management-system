const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file,mocks={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>id in mocks?mocks[id]:require(id),Date,console,JSON},{filename:file}); return exports }
const taipeiDate = d => d ? d.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}) : ''
const allocation = load('src/lib/allocation.ts')
const report = load('src/lib/territory-report.ts',{'./do-not-visit-list':load('src/lib/do-not-visit-list.ts'),'./allocation':allocation,'./google-sheets':{taipeiDate},'@prisma/client':{Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}}}})
const now = new Date('2026-10-23T12:00:00+08:00')
const tp = s => new Date(`${s}T10:00:00+08:00`)
const input = (o={}) => report.parseReportInput({sheetNos:[5],timeslot:'星期六早上',startDate:'2026-10-20',endDate:'2026-10-22',note:'',...o},now)

// 輸入防呆
// 拒絕拜訪地址（ADR-0086）：只收單區、單行、最多 100 字
assert.equal(input({doNotVisit:'  加昌路279巷5號\n 有狗 '}).doNotVisit,'加昌路279巷5號 有狗')
assert.equal(input().doNotVisit,'')
assert.throws(()=>input({sheetNos:[5,6],doNotVisit:'x'}),/回報一區/)
assert.throws(()=>input({doNotVisit:'x'.repeat(101)}),/100 字/)
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

// 每區處理（ADR-0100）
const me={memberId:'m1',name:'王一',admin:false}, boss={memberId:'m9',name:'管理員',admin:true}
const act=(area,actor,end='2026-10-22',pending=false)=>report.classifyReportArea({id:'a',sheetNo:5,completedAt:null,lastReportedCompletedAt:null,...area},actor,end,pending).action
const mine={assignedMemberId:'m1',dispatchedAt:tp('2026-10-10')}, theirs={assignedMemberId:'m2',dispatchedAt:tp('2026-10-10')}, free={assignedMemberId:'m2',dispatchedAt:tp('2026-09-01'),completedAt:tp('2026-09-20')}
assert.equal(act(mine,me),'return'); assert.equal(act(mine,me,'2026-10-05'),'blocked')
assert.equal(act(mine,me,'2026-10-22',true),'return','持有人本人不受待確認阻擋')
assert.equal(act(theirs,me),'confirm'); assert.equal(act(theirs,me,'2026-10-01'),'confirm')
assert.equal(act(free,me),'blocked'); assert.equal(act({assignedMemberId:null,dispatchedAt:null},me),'blocked')
assert.equal(act(theirs,me,'2026-10-22',true),'blocked')
assert.equal(act(theirs,{...me,memberId:null}),'confirm','未登入對不到成員')
assert.equal(act(theirs,boss),'proxy'); assert.equal(act(theirs,boss,'2026-10-01'),'record')
assert.equal(act(free,boss),'record'); assert.equal(act(theirs,boss,'2026-10-22',true),'merge')
// 自主管理（ADR-0101）：未領取的只留紀錄、免確認；別人的照一般規則
const self={...me,selfManaged:true}
assert.equal(act(free,self),'self'); assert.equal(act(theirs,self),'confirm'); assert.equal(act(mine,self),'return'); assert.equal(act(theirs,self,'2026-10-22',true),'blocked')
assert.equal(report.needsConfirmation({action:'self'}),false)
assert.equal(report.needsConfirmation({action:'return'}),false); assert.equal(report.needsConfirmation({action:'confirm'}),true)

let state, appended, failAppend, nextId
function reset(area={}) { nextId=0; state={reports:[],alerts:[],members:{m1:'王一',m2:'李二',m3:'曾湖',m9:'管理員'},area6:{id:'a6',sheetNo:6,assignedMemberId:null,dispatchedAt:null,completedAt:null,lastReportedCompletedAt:null},area:{id:'a5',sheetNo:5,assignedMemberId:'m1',dispatchedAt:tp('2026-10-10'),completedAt:null,lastReportedCompletedAt:new Date('2026-09-01T00:00:00+08:00'),...area}}; appended=[]; failAppend=false }
const withHolder=a=>({...a,assignedMember:a.assignedMemberId?{name:state.members[a.assignedMemberId]}:null})
const matchAlert=(a,w)=>Object.entries(w).every(([k,v])=>k==='areaId_kind_cycleKey'?Object.entries(v).every(([k2,v2])=>a[k2]===v2):a[k]===v)
const db={$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'Serializable');const before=structuredClone(state);const tx={
 member:{findUnique:async({where})=>({id:where.id,name:state.members[where.id],active:true,deletedAt:null,selfManagedReports:where.id==='m3'}),findFirst:async({where})=>where.name==='王一'?{id:'m1',name:'王一',active:true,deletedAt:null}:null},
 area:{findUnique:async({where})=>where.sheetNo===5?withHolder(state.area):where.sheetNo===6?withHolder(state.area6):null,updateMany:async({where,data})=>{const a=state.area;const ok=a.id===where.id&&a.assignedMemberId===where.assignedMemberId&&+a.dispatchedAt===+where.dispatchedAt&&a.completedAt===where.completedAt;if(ok)Object.assign(a,data);return{count:ok?1:0}},update:async({where,data})=>Object.assign(where.id==='a6'?state.area6:state.area,data)},
 report:{findFirst:async({where})=>state.reports.find(r=>r.memberId===where.memberId&&r.content===where.content&&r.submittedAt>=where.submittedAt.gte)||null,create:async({data})=>{const r={id:`r${++nextId}`,...data};state.reports.push(r);return r}},
 reportAlert:{findFirst:async({where})=>state.alerts.find(a=>matchAlert(a,where))||null,findUnique:async({where})=>state.alerts.find(a=>matchAlert(a,where))||null,create:async({data})=>{state.alerts.push({id:`al${++nextId}`,status:'pending',...data})},update:async({where,data})=>Object.assign(state.alerts.find(a=>a.id===where.id),data)}}
 try{return await fn(tx)}catch(e){state=before;throw e}}}
const append=async rows=>{if(failAppend)throw new Error('sheet down');appended.push(...rows)}
const ok={confirmed:true}, asBoss={admin:true,confirmed:true}
;(async()=>{
 reset(); let r=await report.submitTerritoryReport(db,'m1',input(),append,now)
 assert.equal(r[0].action,'return'); assert.equal(+state.area.completedAt,+now); assert.equal(taipeiDate(state.area.lastReportedCompletedAt),'2026-10-22'); assert.equal(appended.length,1); assert.equal(appended[0][1],'王一')
 assert.equal(allocation.isAreaDispatched(state.area),false,'交回後不再使用中')
 assert.equal(state.area.returnUndo.memberId,'m1'); assert.equal(state.area.returnUndo.endDate,'2026-10-22'); assert.equal(state.area.returnUndo.returnedAt,now.toISOString()); assert.equal(state.area.returnUndo.completedAt,null)
 await assert.rejects(report.submitTerritoryReport(db,'m1',input(),append,now),/目前未領取/,'交回後再送就是未領取')

 reset(); await assert.rejects(report.submitTerritoryReport(db,'m1',input({startDate:'2026-10-01',endDate:'2026-10-05'}),append,now),/早於您領取/)
 assert.equal(appended.length,0)

 // 別人的地圖：要確認、不交回、建待確認
 reset({assignedMemberId:'m2'}); await assert.rejects(report.submitTerritoryReport(db,'m1',input(),append,now),/需要確認/)
 assert.equal(appended.length,0); assert.equal(state.alerts.length,0)
 r=await report.submitTerritoryReport(db,'m1',input(),append,now,ok)
 assert.equal(r[0].action,'confirm'); assert.equal(state.area.completedAt,null,'不交回'); assert.equal(taipeiDate(state.area.lastReportedCompletedAt),'2026-10-22'); assert.equal(appended[0][1],'王一')
 assert.equal(state.alerts.length,1); assert.equal(state.alerts[0].kind,'not_holder'); assert.equal(state.alerts[0].cycleKey,tp('2026-10-10').toISOString()); assert.equal(state.alerts[0].details.holder,'李二'); assert.equal(state.alerts[0].details.reports[0].name,'王一'); assert.equal(state.alerts[0].reportId,'r1')
 // 第二人（一般成員）被擋；管理員併入同一則
 await assert.rejects(report.submitTerritoryReport(db,null,report.parseReportInput({name:'陳三',sheetNos:[5],timeslot:'x',startDate:'2026-10-20',endDate:'2026-10-21'},now,true),append,now,ok),/已有人回報/)
 r=await report.submitTerritoryReport(db,'m9',input({endDate:'2026-10-21'}),append,now,asBoss)
 assert.equal(r[0].action,'merge'); assert.equal(state.alerts.length,1); assert.equal(state.alerts[0].details.reports.length,2); assert.equal(state.area.completedAt,null)
 // 持有人自己回報：交回，待確認自動結案
 r=await report.submitTerritoryReport(db,'m2',input({endDate:'2026-10-22',note:'本人'}),append,now)
 assert.equal(r[0].action,'return'); assert.equal(state.alerts[0].status,'pending','留給管理員知道'); assert.equal(state.alerts[0].kind,'not_holder_returned'); assert.equal(state.alerts[0].details.holderReturned.name,'李二'); assert.equal(state.alerts[0].details.reports.length,2)

 // 管理員代持有人回報並交回：Sheet 與紀錄記在持有人名下
 reset({assignedMemberId:'m2'}); await assert.rejects(report.submitTerritoryReport(db,'m9',input(),append,now,{admin:true}),/需要確認/)
 r=await report.submitTerritoryReport(db,'m9',input(),append,now,asBoss)
 assert.equal(r[0].action,'proxy'); assert.equal(+state.area.completedAt,+now); assert.equal(appended[0][1],'李二'); assert.equal(state.reports[0].memberId,'m2'); assert.equal(JSON.parse(state.reports[0].content).reportedBy,'管理員')
 reset({assignedMemberId:'m2'}); r=await report.submitTerritoryReport(db,'m9',input({startDate:'2026-10-01',endDate:'2026-10-05'}),append,now,asBoss)
 assert.equal(r[0].action,'record','結束日早於持有人領取日只留紀錄'); assert.equal(state.area.completedAt,null)

 // 未領取：一般成員擋下，管理員只留紀錄
 reset({assignedMemberId:null}); await assert.rejects(report.submitTerritoryReport(db,'m1',input(),append,now,ok),/目前未領取，請洽管理員/)
 r=await report.submitTerritoryReport(db,'m9',input(),append,now,asBoss); assert.equal(r[0].action,'record'); assert.equal(appended.length,1); assert.equal(taipeiDate(state.area.lastReportedCompletedAt),'2026-10-22')

 // 自主管理：未領取的不擋、免確認，只留紀錄
 reset({assignedMemberId:null}); r=await report.submitTerritoryReport(db,'m3',input(),append,now); assert.equal(r[0].action,'self'); assert.equal(state.area.completedAt,null); assert.equal(appended[0][1],'曾湖'); assert.equal(state.reports.length,1)
 reset({assignedMemberId:'m2'}); await assert.rejects(report.submitTerritoryReport(db,'m3',input(),append,now),/需要確認/)

 reset(); failAppend=true; await assert.rejects(report.submitTerritoryReport(db,'m1',input(),append,now),/sheet down/)
 assert.equal(state.area.completedAt,null,'Sheet 失敗整筆回滾'); assert.equal(state.reports.length,0)
 // 多區：任何一區被擋就整筆不送
 reset(); await assert.rejects(report.submitTerritoryReport(db,'m1',input({sheetNos:[5,6]}),append,now,ok),/6 號：這張地圖目前未領取/)
 assert.equal(state.area.completedAt,null); assert.equal(appended.length,0)
 reset(); state.area6={...state.area6,assignedMemberId:'m2',dispatchedAt:tp('2026-10-01')}; await assert.rejects(report.submitTerritoryReport(db,'m1',input({sheetNos:[5,6]}),append,now),/6 號需要確認/)
 r=await report.submitTerritoryReport(db,'m1',input({sheetNos:[5,6]}),append,now,ok)
 assert.equal(JSON.stringify(r.map(x=>[x.sheetNo,x.action])),'[[5,"return"],[6,"confirm"]]'); assert.equal(appended.map(x=>x[3]).join(),'5,6'); assert.equal(state.reports.length,2)
 reset(); await assert.rejects(report.submitTerritoryReport(db,'m1',input({sheetNos:[5,99]}),append,now),/找不到區域號碼 99/)
 assert.equal(state.area.completedAt,null); assert.equal(state.reports.length,0); assert.equal(appended.length,0)
 // 未登入：須填姓名；對到持有人才算本人，對不到只寫 Sheet，永遠不算管理員
 assert.throws(()=>report.parseReportInput({sheetNos:[5],timeslot:'x',startDate:'2026-10-20',endDate:'2026-10-22'},now,true),/姓名/)
 assert.equal(report.parseReportInput({name:'不採用',sheetNos:[5],timeslot:'x',startDate:'2026-10-20',endDate:'2026-10-22'},now).name,'','登入者不採用 body 姓名')
 const guest=o=>report.parseReportInput({sheetNos:[5],timeslot:'星期六早上',startDate:'2026-10-20',endDate:'2026-10-22',...o},now,true)
 reset(); await assert.rejects(report.submitTerritoryReport(db,null,guest({name:'王一',startDate:'2026-10-01',endDate:'2026-10-05'}),append,now),/早於您領取/)
 reset(); r=await report.submitTerritoryReport(db,null,guest({name:'王一'}),append,now); assert.equal(r[0].action,'return'); assert.equal(state.reports[0].memberId,'m1')
 reset(); r=await report.submitTerritoryReport(db,null,guest({name:' 陳 三 '}),append,now,ok)
 assert.equal(r[0].action,'confirm','對不到持有人：交管理員確認'); assert.equal(state.area.completedAt,null); assert.equal(state.reports.length,0,'對不到成員不留紀錄'); assert.equal(appended[0][1],'陳 三'); assert.equal(state.alerts[0].details.reports[0].name,'陳 三')
 reset({assignedMemberId:null}); await assert.rejects(report.submitTerritoryReport(db,null,guest({name:'陳三'}),append,now,{admin:true,confirmed:true}),/目前未領取/,'未登入不算管理員')
 console.log('territory report checks passed')
})().catch(e=>{console.error(e);process.exit(1)})
