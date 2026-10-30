const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file,mocks={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>id in mocks?mocks[id]:require(id),Date,console,JSON},{filename:file}); return exports }
const taipeiDate = d => d ? d.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}) : ''
const Prisma = {DbNull:'DbNull',TransactionIsolationLevel:{Serializable:'Serializable'}}
const allocation = load('src/lib/allocation.ts')
const report = load('src/lib/territory-report.ts',{'./do-not-visit-list':load('src/lib/do-not-visit-list.ts'),'./allocation':allocation,'./google-sheets':{taipeiDate},'@prisma/client':{Prisma}})
const alerts = load('src/lib/report-alerts.ts',{'./allocation':allocation,'./google-sheets':{taipeiDate},'./territory-report':report,'@prisma/client':{Prisma}})
const tp = s => new Date(`${s}T10:00:00+08:00`), day = s => new Date(`${s}T00:00:00+08:00`)
const now = new Date('2026-10-30T12:00:00+08:00'), returnedAt = tp('2026-10-23')

// 交回依據：同一次交回、未再派發，且最後回報日退回結束日之前
const undo = {memberId:'m1',holder:'王一',dispatchedAt:tp('2026-10-10').toISOString(),completedAt:null,endDate:'2026-10-22',returnedAt:returnedAt.toISOString()}
const returned = o => ({id:'a5',sheetNo:5,assignedMemberId:'m1',dispatchedAt:tp('2026-10-10'),completedAt:returnedAt,lastReportedCompletedAt:day('2026-10-22'),returnUndo:undo,...o})
assert.equal(alerts.basisRemoved(returned()),null,'回報還在')
assert.equal(alerts.basisRemoved(returned({lastReportedCompletedAt:day('2026-10-01')})).holder,'王一','回報被刪，退回較早日期')
assert.ok(alerts.basisRemoved(returned({lastReportedCompletedAt:null})),'回報全被刪')
assert.equal(alerts.basisRemoved(returned({lastReportedCompletedAt:null,dispatchedAt:tp('2026-10-25'),completedAt:null})),null,'已重新派發')
assert.equal(alerts.basisRemoved(returned({lastReportedCompletedAt:null,completedAt:tp('2026-10-24')})),null,'之後又被收回過')
assert.equal(alerts.currentHolder({assignedMemberId:'m1',dispatchedAt:tp('2026-10-10'),completedAt:returnedAt,assignedMember:{name:'王一'}}),'','已交回的系統持有人是空白')
assert.equal(alerts.currentHolder({assignedMemberId:'m1',dispatchedAt:tp('2026-10-10'),completedAt:null,assignedMember:{name:'王一'}}),'王一')

// 同步偵測
function mockDb(areas, existing=[]) {
  const state={areas,alerts:existing.map(a=>({...a})),members:[{id:'m1',name:'王一',deletedAt:null},{id:'m2',name:'李二',deletedAt:null}]}
  const keyOf=a=>`${a.areaId}|${a.kind}|${a.cycleKey}`
  const db={state,
    area:{findMany:async()=>state.areas,updateMany:async({where,data})=>{const a=state.areas.find(x=>x.id===where.id);const ok=a&&Object.entries(where).every(([k,v])=>k==='id'||(v instanceof Date?+a[k]===+v:a[k]===v));if(ok)Object.assign(a,data);return{count:ok?1:0}},update:async({where,data})=>Object.assign(state.areas.find(x=>x.id===where.id),data)},
    member:{findFirst:async({where})=>state.members.find(m=>(where.id?m.id===where.id:m.name===where.name))||null},
    reportAlert:{findMany:async()=>state.alerts,createMany:async({data})=>{let n=0;for(const d of data){if(state.alerts.some(a=>keyOf(a)===keyOf(d)))continue;state.alerts.push({id:`al${state.alerts.length+1}`,status:'pending',...d});n++}return{count:n}},
      updateMany:async({where,data})=>{let n=0;for(const a of state.alerts)if(where.id.in.includes(a.id)&&a.status===where.status){Object.assign(a,data);n++}return{count:n}},
      findUnique:async({where})=>{const a=state.alerts.find(x=>x.id===where.id);return a&&{...a,area:{...state.areas.find(x=>x.id===a.areaId),assignedMember:{name:'王一'}}}},
      update:async({where,data})=>Object.assign(state.alerts.find(x=>x.id===where.id),data)},
    $transaction:async(fn)=>fn(db)}
  return db
}
;(async()=>{
  const held = {id:'a1',sheetNo:1,assignedMemberId:'m1',dispatchedAt:tp('2026-10-10'),completedAt:null,lastReportedCompletedAt:day('2026-10-20'),returnUndo:null}
  const sameDay = {id:'a2',sheetNo:2,assignedMemberId:'m1',dispatchedAt:tp('2026-10-10'),completedAt:null,lastReportedCompletedAt:day('2026-10-10'),returnUndo:null}
  const notHolderArea = {id:'a3',sheetNo:3,assignedMemberId:'m2',dispatchedAt:tp('2026-10-10'),completedAt:null,lastReportedCompletedAt:day('2026-10-21'),returnUndo:null}
  const removed = returned({id:'a5',lastReportedCompletedAt:day('2026-10-01')})
  let db = mockDb([held,sameDay,notHolderArea,removed,{id:'a7',sheetNo:7,assignedMemberId:null,dispatchedAt:null,completedAt:null,lastReportedCompletedAt:null,returnUndo:null}],[{id:'x',areaId:'a3',kind:'not_holder',cycleKey:tp('2026-10-10').toISOString(),status:'pending'}])
  let r = await alerts.syncReportAlerts(db,[{sheetNo:7,sheetMember:'李二',sheetDate:'2026-10-29',dbMember:'',dbDate:''}],now)
  const kinds = db.state.alerts.map(a=>`${a.areaId}:${a.kind}`).sort().join()
  assert.equal(kinds,'a1:held_after_report,a3:not_holder,a5:return_basis_removed,a7:sheet_holder_mismatch','同一天不算、回報他人地圖不重複提醒')
  assert.equal(r.created,3); assert.equal(r.autoResolved,0)
  r = await alerts.syncReportAlerts(db,[],now); assert.equal(r.created,0,'同一輪不重複建立')
  // 維持使用中後同一輪不再提醒；有新的回報日才再出現
  const h = db.state.alerts.find(a=>a.kind==='held_after_report'); h.status='resolved'
  await alerts.syncReportAlerts(db,[],now); assert.equal(db.state.alerts.filter(a=>a.kind==='held_after_report').length,1)
  held.lastReportedCompletedAt = day('2026-10-25'); await alerts.syncReportAlerts(db,[],now)
  assert.equal(db.state.alerts.filter(a=>a.kind==='held_after_report'&&a.status==='pending').length,1,'新的回報日再提醒')
  // 狀態變了的自動結案
  held.completedAt = now; notHolderArea.completedAt = now; removed.lastReportedCompletedAt = day('2026-10-22')
  r = await alerts.syncReportAlerts(db,[],now)
  assert.equal(r.autoResolved,3); assert.ok(db.state.alerts.filter(a=>a.kind!=='sheet_holder_mismatch').every(a=>a.status==='resolved'))
  assert.equal(db.state.alerts.find(a=>a.kind==='sheet_holder_mismatch').status,'pending','C 欄衝突等管理員處理')

  // 處理：恢復使用中
  db = mockDb([returned({lastReportedCompletedAt:day('2026-10-01')})]); await alerts.syncReportAlerts(db,[],now)
  let out = await alerts.resolveReportAlert(db,'al1','restore','管理員',now)
  const a5 = db.state.areas[0]
  assert.equal(a5.assignedMemberId,'m1'); assert.equal(+a5.dispatchedAt,+tp('2026-10-10'),'保留原領取日'); assert.equal(a5.completedAt,null); assert.equal(a5.returnUndo,'DbNull'); assert.equal(allocation.isAreaDispatched(a5),true)
  assert.equal(out.sheet.member,'王一'); assert.equal(out.sheet.keepDate,false); assert.equal(db.state.alerts[0].resolvedBy,'管理員'); assert.equal(db.state.alerts[0].resolution,'restore')
  await assert.rejects(alerts.resolveReportAlert(db,'al1','restore','管理員',now),/已處理過/)
  // 處理：交回（回報了卻未交回）
  db = mockDb([{...held,lastReportedCompletedAt:day('2026-10-20'),completedAt:null}]); await alerts.syncReportAlerts(db,[],now)
  await assert.rejects(alerts.resolveReportAlert(db,'al1','restore','管理員',now),/操作無效/)
  out = await alerts.resolveReportAlert(db,'al1','return','管理員',now)
  assert.equal(+db.state.areas[0].completedAt,+now); assert.equal(db.state.areas[0].returnUndo.endDate,'2026-10-20'); assert.equal(out.sheet.keepDate,true)
  // 狀態已變：自動結案，不動地圖
  db = mockDb([{...held,completedAt:null}]); await alerts.syncReportAlerts(db,[],now); db.state.areas[0].dispatchedAt = tp('2026-10-26')
  out = await alerts.resolveReportAlert(db,'al1','return','管理員',now); assert.equal(out.stale,true); assert.equal(db.state.areas[0].completedAt,null); assert.equal(db.state.alerts[0].resolution,'auto')
  // 以 Sheet 為準
  const a7 = {id:'a7',sheetNo:7,assignedMemberId:null,dispatchedAt:null,completedAt:null,lastReportedCompletedAt:null,returnUndo:null}
  db = mockDb([a7]); await alerts.syncReportAlerts(db,[{sheetNo:7,sheetMember:'李二',sheetDate:'2026-10-29',dbMember:'',dbDate:''}],now)
  out = await alerts.resolveReportAlert(db,'al1','use_sheet','管理員',now)
  assert.equal(a7.assignedMemberId,'m2'); assert.equal(taipeiDate(a7.dispatchedAt),'2026-10-29'); assert.equal(out.sheet.member,'李二')
  db = mockDb([{...a7,assignedMemberId:null,dispatchedAt:null}]); await alerts.syncReportAlerts(db,[{sheetNo:7,sheetMember:'不存在',sheetDate:'2026-10-29',dbMember:'',dbDate:''}],now)
  await assert.rejects(alerts.resolveReportAlert(db,'al1','use_sheet','管理員',now),/成員名單沒有/)
  // 說明文字
  assert.match(alerts.describeAlert({kind:'not_holder',details:{holder:'李二',dispatched:'2026-10-10',reports:[{name:'王一',endDate:'2026-10-22'}]}},'','').text,/王一 回報了 李二 領取中的地圖/)
  assert.match(alerts.describeAlert({kind:'return_basis_removed',details:undo},'','').text,/2026-10-22 結束的回報交回/)
  console.log('report alert checks passed')
})().catch(e=>{console.error(e);process.exit(1)})
