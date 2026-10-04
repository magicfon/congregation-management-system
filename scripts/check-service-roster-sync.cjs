const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, mocks = {}) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => id in mocks ? mocks[id] : require(id), Date, console, AbortSignal, Set, Map }, { filename: file }); return exports;
}
const roles = load('src/lib/service-roster.ts');
const plan = load('src/lib/service-roster-sync-plan.ts', { './service-roster': roles });
const taipeiDate = date => date.toLocaleDateString('sv-SE', {timeZone:'Asia/Taipei'});
let requests = 0;
const sheet = load('src/lib/service-roster-sheet.ts', { './google-sheets': {taipeiDate, spreadsheetRequest:async()=>{requests++;throw new Error('No network in unit test')}}, './service-roster-import':{SERVICE_SHEET_ID:'fixture'}, './service-roster': roles, './service-roster-sync-plan':plan });
const day='2027-01-04';
const base={startDate:day,endDate:'2027-01-10',stopped:false,note:'',names:{host:'甲',audio:'音響人員',video:'影像人員'}};
const change=(note)=>({...base,note});
const remote=(week=base,s='Schedule')=>({sheet:s,row:2,week});
assert.ok(plan.planWeek(day,base,[remote()]).target);
assert.ok(plan.planWeek(day,change('本站'),[remote()],base).target.note==='本站');
assert.ok(plan.planWeek(day,base,[remote(change('Google'))],base).target.note==='Google');
assert.ok(plan.planWeek(day,change('本站'),[remote(change('Google'))],base).conflict);
assert.ok(plan.planWeek(day,change('本站'),[remote()]).conflict,'First connect must not overwrite differences');
assert.ok(plan.planWeek(day,base,[],base).conflict,'Deleted source must not erase local data');
assert.ok(plan.planWeek(day,base,[]).target,'New local weeks are pushed');
assert.ok(plan.planWeek(day,null,[remote()]).target,'New Google weeks are imported');
assert.equal(plan.planWeek(day,base,[remote(change('Sheet')),remote(base,'History')],base).target.note,'Sheet');
assert.ok(plan.planWeek(day,base,[remote(change('A')),remote(change('B'),'History')],base).conflict);
const conflict=plan.planWeek(day,change('本站'),[remote(change('Google'))],base).conflict;
assert.equal(plan.planWeek(day,change('本站'),[remote(change('Google'))],base,{date:day,id:conflict.id,choice:'Schedule'}).target.note,'Google');
assert.throws(()=>plan.planWeek(day,change('新變更'),[remote(change('Google'))],base,{date:day,id:conflict.id,choice:'local'}),/已變更/);
const cell = v => ({effectiveValue: typeof v==='number'?{numberValue:v}:{stringValue:v}});
const serial= (Date.UTC(2027,0,4)-Date.UTC(1899,11,30))/86400000;
const headers=['週別','日期','','','招待當值','替補招待','會堂招待員','守望台朗讀','麥克風傳遞員 A','麥克風傳遞員 B','講台','影像控制','音響控制','周中聚會主席','周中聚會朗讀'];
function grid(title){return {properties:{title,gridProperties:{rowCount:100,columnCount:26}},data:[{rowData:[{values:headers.map(cell)},{values:[1,serial,'~',serial+6,'甲','','','','','','','影像人員','音響人員','',''].map(cell)}]}]};}
const source=sheet.parseSheets([grid('Schedule'),grid('History')]);
const fullSheets = [grid('Schedule'), grid('History')];
fullSheets.forEach((s, i) => { s.properties.sheetId = i; s.properties.gridProperties.rowCount = 2; });
const expansion = sheet.prepareWrites(sheet.parseSheets(fullSheets), [{...base, startDate:'2027-01-11', endDate:'2027-01-17'}]);
assert.equal(expansion.expand.length, 2);
assert.equal(expansion.expand[0].updateSheetProperties.properties.gridProperties.rowCount, 3);
assert.equal(source.rows[0].week.names.audio,'音響人員');assert.equal(source.rows[0].week.names.video,'影像人員');
assert.equal(source.rows[0].week.startDate,day);
assert.equal(sheet.prepareWrites(source,[base]).pushed,0);
const writes=sheet.prepareWrites(source,[{...base,names:{...base.names,audio:'新音響'}}]);
assert.ok(writes.data.some(d=>d.range==="'Schedule'!M2"&&d.values[0][0]==='新音響'));
assert.ok(!writes.data.some(d=>d.range.includes('People')));
const formula=grid('Schedule');formula.data[0].rowData[1].values[12].userEnteredValue={formulaValue:'=X1'};
assert.throws(()=>sheet.prepareWrites(sheet.parseSheets([formula,grid('History')]),[change('note')]),/公式/);
const merged=grid('Schedule');merged.merges=[{startRowIndex:1,endRowIndex:2,startColumnIndex:4,endColumnIndex:15}];
assert.throws(()=>sheet.prepareWrites(sheet.parseSheets([merged,grid('History')]),[change('note')]),/合併/);
const stopped=grid('Schedule');stopped.data[0].rowData[1].values.splice(4,11,...['沒有周中聚會 分區大會',...Array(10).fill('')].map(cell));
assert.equal(sheet.parseSheets([stopped,grid('History')]).rows[0].week.stopped,true);
const badHeader=grid('Schedule');badHeader.data[0].rowData[0].values[12]=cell('未知欄');
assert.throws(()=>sheet.parseSheets([badHeader,grid('History')]),/標題/);
let local=[{...base,assignments:{host:{personId:'p1',name:'甲'},audio:{personId:'p2',name:'音響人員'},video:{personId:'p3',name:'影像人員'}}}], incoming=[remote(),remote(base,'History')], persisted, revision=1, locked=true, writesCount=0, failWrite=false;
const people=[['p1','甲'],['p2','音響人員'],['p3','影像人員']].map(([id,name])=>({id,name,memberId:id,enabled:true,roles:roles.serviceRoles.map(r=>r.id)}));
const coordinator=load('src/lib/service-roster-sync.ts', {'./service-roster':roles,'./service-roster-sync-plan':plan,'./service-roster-sheet':{
 readRosterSheet:async()=>({rows:incoming}),writeRosterSheet:async(_,targets)=>{if(failWrite)throw new Error('Google offline');let changed=0;for(const target of targets){for(const row of incoming){if(row.week.startDate===target.startDate&&!plan.sameWeek(row.week,target)){row.week=target;changed++;}}}writesCount+=changed;return changed;}
}});
const tx={
 $queryRaw:async(strings)=>String(strings).includes('pg_try')?[{locked}]:[{revision}],
 setting:{findUnique:async()=>persisted?{value:persisted}:null,upsert:async({update})=>{persisted=update.value}},
 member:{findMany:async()=>people.map(p=>({id:p.id}))},servicePerson:{findMany:async()=>people},
 serviceRosterState:{update:async()=>{revision++}},
 serviceWeek:{findMany:async()=>local,upsert:async({create})=>{local=[...local.filter(w=>w.startDate!==create.startDate),create]}}
};
const db={...tx,$transaction:async fn=>{const saved=persisted,old=structuredClone(local),rev=revision;try{return await fn(tx)}catch(e){persisted=saved;local=old;revision=rev;throw e}}};
(async()=>{
 let result=await coordinator.syncServiceRoster(db);assert.equal(result.errors.length,0);assert.equal(result.conflicts.length,0);
 incoming=[remote(change('Google')),remote(base,'History')];
 result=await coordinator.syncServiceRoster(db);assert.equal(result.pulled,1);assert.equal(result.pushed,1);assert.equal(local[0].note,'Google');
 result=await coordinator.syncServiceRoster(db);assert.equal(result.pulled,0);assert.equal(result.pushed,0);assert.equal(result.conflicts.length,0);
 local[0].note='網站';incoming=[remote(change('Sheet new')),remote(change('Google'),'History')];
 result=await coordinator.syncServiceRoster(db);assert.equal(result.conflicts.length,1);assert.equal(result.pulled,0);assert.equal(local[0].note,'網站');
 result=await coordinator.syncServiceRoster(db,{date:day,id:result.conflicts[0].id,choice:'local',revision});assert.equal(result.errors.length,0);assert.equal(result.conflicts.length,0);assert.equal(result.pushed,2);
 const baseline=persisted;local[0].note='待推送';failWrite=true;
 result=await coordinator.syncServiceRoster(db);assert.equal(result.errors.length,1);assert.equal(persisted,baseline,'Failed write must not advance baseline');failWrite=false;
 locked=false;const count=writesCount;result=await coordinator.syncServiceRoster(db);assert.equal(writesCount,count);assert.match(result.errors[0],/另一個同步/);
 assert.throws(()=>coordinator.importedAssignments({...base,names:{host:'未知'}},{},people),/資格/);
 assert.throws(()=>coordinator.importedAssignments({...base,names:{host:'甲'}},{},[{...people[0],roles:[]}]),/資格/);
 assert.equal(requests,0);
 console.log('Roster sync: three-way conflicts, stale resolution, column mapping, formulas, merges, qualification, retry, concurrency and idempotence passed');
})().catch(e=>{console.error(e);process.exitCode=1});
