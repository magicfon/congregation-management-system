const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const ex={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/ministry-week.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:ex});
const {ministryWeek}=ex;
for(const [today,start,end] of [['2026-09-30','2026-09-28','2026-10-04'],['2026-10-04','2026-09-28','2026-10-04'],['2026-10-05','2026-10-05','2026-10-11'],['2027-01-01','2026-12-28','2027-01-03'],['2028-02-29','2028-02-28','2028-03-05']]){
 const week=ministryWeek(today,[]);assert.equal(week.days[0].date,start);assert.equal(week.days[6].date,end);assert.equal(week.days.length,7);
}
const tasks=['2026-09-27','2026-09-28','2026-10-04','2026-10-05'].map((date,i)=>({id:String(i),areaId:'a',label:'map',date,status:i?'planned':'active'}));
const w=ministryWeek('2026-09-30',tasks);assert.equal(w.earlier[0].status,'active');assert.equal(w.days[0].tasks.length,1);assert.equal(w.days[6].tasks.length,1);assert.equal(w.later.length,1);assert.equal(tasks.length,4);
console.log('PASS: Monday/Sunday boundaries, month/year/leap-day rollover, overdue work, future plans and immutable inputs.');
