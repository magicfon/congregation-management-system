const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file,mocks={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>id in mocks?mocks[id]:require(id),Date,console,JSON,Number,String,Math,Infinity},{filename:file}); return exports }
const taipeiDate = d => d ? d.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}) : ''
const Prisma = {DbNull:'DbNull',TransactionIsolationLevel:{Serializable:'Serializable'}}
const allocation = load('src/lib/allocation.ts')
const w = load('src/lib/report-withdraw.ts',{'@prisma/client':{Prisma},'./allocation':allocation,'./google-sheets':{taipeiDate},'./area-report-history':load('src/lib/area-report-history.ts'),'./territory-report':{TerritoryReportError:class extends Error{constructor(m,s){super(m);this.status=s}}}})

// 時間戳記：上午／下午與 24 小時制都當台北時間
assert.equal(w.parseSheetTimestamp('2026/11/16 下午 1:05:09').toISOString(),'2026-11-16T05:05:09.000Z')
assert.equal(w.parseSheetTimestamp('2026/11/16 上午 12:00:01').toISOString(),'2026-11-15T16:00:01.000Z')
assert.equal(w.parseSheetTimestamp('2026/11/16 13:05:09').toISOString(),'2026-11-16T05:05:09.000Z')
assert.equal(w.parseSheetTimestamp('亂打'),null)

const rows = w.parseReportRows([
  ['2026/11/1 上午 9:00:00','王一','星期六早上','5','2026/10/20','2026/10/31',''],
  ['2026/11/10 上午 9:00:00','李二','星期六早上','5','2026/11/1','2026/11/9',''],
  ['','','','','','',''],
  ['2026/11/12 上午 9:00:00','王一','星期六早上','7','2026/11/1','2026/11/11',''],
  ['2026/11/11 上午 9:00:00','王一','星期六早上','5','2026/9/1','2026/9/5','補報'],
])
assert.equal(rows.map(r=>r.row).join(),'2,3,5,6','空列略過，列號對應 Sheet')
const latest = w.latestReports(rows)
assert.equal(latest.get(5).row,6,'最近一筆依送出時間，不依結束日')
assert.equal(latest.get(7).row,5)
assert.equal(w.reportKey(latest.get(7)),'5|2026/11/12 上午 9:00:00|7|王一|2026-11-11')

const tp = s => new Date(`${s}T10:00:00+08:00`), day = s => new Date(`${s}T00:00:00+08:00`)
// 交回後未再派發 → 恢復；最後完成日退回剩下最晚的結束日
const returnedAt = tp('2026-11-10')
const undo = {memberId:'m2',holder:'李二',dispatchedAt:tp('2026-10-25').toISOString(),completedAt:null,endDate:'2026-11-09',returnedAt:returnedAt.toISOString()}
const r3 = rows.find(r=>r.row===3)
let plan = w.planWithdraw({assignedMemberId:'m2',dispatchedAt:tp('2026-10-25'),completedAt:returnedAt,returnUndo:undo},r3,rows)
assert.equal(plan.restore.holder,'李二'); assert.equal(plan.notRestored,false)
assert.equal(taipeiDate(plan.lastReportedCompletedAt),'2026-10-31')
// 之後重新派發 → 不恢復
plan = w.planWithdraw({assignedMemberId:'m1',dispatchedAt:tp('2026-11-12'),completedAt:returnedAt,returnUndo:undo},r3,rows)
assert.equal(plan.restore,null); assert.equal(plan.notRestored,true)
// 交回依據是別筆回報 → 不動分配
plan = w.planWithdraw({assignedMemberId:'m2',dispatchedAt:tp('2026-10-25'),completedAt:returnedAt,returnUndo:{...undo,endDate:'2026-10-31'}},r3,rows)
assert.equal(plan.restore,null); assert.equal(plan.notRestored,false)
// 沒有其他回報 → 最後完成日清空
assert.equal(w.planWithdraw({assignedMemberId:null,dispatchedAt:null,completedAt:null,returnUndo:null},latest.get(7),rows).lastReportedCompletedAt,null)
// 個人管理：退回最新那次 → 領取日改回剩下最新一筆的開始日；退回較舊的補報 → 不動
const managed = {assignedMemberId:'m2',dispatchedAt:day('2026-11-01'),completedAt:null,personalManaged:true,returnUndo:null}
assert.equal(taipeiDate(w.planWithdraw(managed,r3,rows).managedStart),'2026-10-20')
assert.equal(w.planWithdraw(managed,rows.find(r=>r.row===6),rows).managedStart,null)
assert.equal(w.planWithdraw(managed,latest.get(7),rows).managedNoPrevious,true)

// 系統回報紀錄比對：同區同期間、送出時間幾秒內
const content = JSON.stringify({source:'territory-report',sheetNo:5,timeslot:'星期六早上',startDate:'2026-11-01',endDate:'2026-11-09',note:''})
assert.ok(w.matchesReportRecord({content,submittedAt:new Date(r3.submittedAt.getTime()+800)},r3))
assert.ok(!w.matchesReportRecord({content,submittedAt:new Date(r3.submittedAt.getTime()+60000)},r3))
assert.ok(!w.matchesReportRecord({content:content.replace('"sheetNo":5','"sheetNo":6'),submittedAt:r3.submittedAt},r3))

// 交易：恢復使用中、刪紀錄、待確認移除、拒訪待審刪除，Sheet 刪列最後
;(async()=>{
  const area = {id:'a5',sheetNo:5,assignedMemberId:'m2',assignedTo:'李二',dispatchedAt:tp('2026-10-25'),completedAt:returnedAt,personalManaged:false,returnUndo:undo,assignedMember:{name:'李二'}}
  const state = {area, reports:[{id:'r1',content,submittedAt:r3.submittedAt}], alerts:[
    {id:'x1',areaId:'a5',kind:'not_holder_returned',status:'pending',cycleKey:'c',details:{reports:[{name:'王一',endDate:'2026-11-05'}],holderReturned:{name:'李二',endDate:'2026-11-09'}}},
    {id:'x2',areaId:'a5',kind:'return_basis_removed',status:'pending',cycleKey:returnedAt.toISOString()}], dnv:1, order:[]}
  const tx = {
    area:{findUnique:async()=>state.area,updateMany:async({where,data})=>{const ok=['assignedMemberId','dispatchedAt','completedAt'].every(k=>String(where[k])===String(state.area[k]));if(ok)Object.assign(state.area,data);state.order.push('area');return{count:ok?1:0}}},
    member:{findFirst:async()=>({id:'m2',name:'李二'})},
    report:{findMany:async()=>state.reports,delete:async({where})=>{state.reports=state.reports.filter(r=>r.id!==where.id)}},
    reportAlert:{findMany:async()=>state.alerts.filter(a=>a.kind.startsWith('not_holder')),findUnique:async()=>null,update:async({where,data})=>Object.assign(state.alerts.find(a=>a.id===where.id),data),updateMany:async({where,data})=>{for(const a of state.alerts)if(a.kind===where.kind&&a.cycleKey===where.cycleKey&&a.status==='pending')Object.assign(a,data);return{count:1}}},
    doNotVisitReport:{deleteMany:async()=>({count:state.dnv})},
  }
  const db = {$transaction:async fn=>fn(tx)}
  const res = await w.withdrawReport(db,r3,rows,'管理員',async()=>{state.order.push('sheet')})
  assert.equal(state.area.assignedMemberId,'m2'); assert.equal(state.area.completedAt,null); assert.equal(state.area.returnUndo,'DbNull')
  assert.equal(taipeiDate(state.area.lastReportedCompletedAt),'2026-10-31')
  assert.equal(state.reports.length,0,'系統回報紀錄刪除')
  assert.equal(state.alerts[0].kind,'not_holder','本人交回被退回，回到回報他人地圖'); assert.equal(state.alerts[0].details.holderReturned,undefined)
  assert.equal(state.alerts[1].status,'resolved','交回依據已刪除的待確認結案')
  assert.equal(res.sheet.member,'李二'); assert.equal(state.order.at(-1),'sheet','Sheet 刪列在最後')
  assert.ok(res.done.some(d=>d.includes('拒訪待審')))
  // 地圖狀態被改過 → 整筆不做
  state.area = {...area, completedAt:returnedAt, assignedMemberId:'m2', returnUndo:undo}
  const tx2 = {...tx, area:{findUnique:async()=>state.area,updateMany:async()=>({count:0})}}
  await assert.rejects(w.withdrawReport({$transaction:async fn=>fn(tx2)},r3,rows,'管理員',async()=>{throw new Error('不該刪')}),/剛被更新/)
  console.log('report withdraw checks passed')
})().catch(e=>{console.error(e);process.exit(1)})
