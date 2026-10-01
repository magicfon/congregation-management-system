const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const ex={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/ministry-week.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:ex});
const {ministryWeek}=ex;
for(const [today,start,end] of [['2026-09-30','2026-09-25','2026-10-01'],['2026-10-01','2026-09-25','2026-10-01'],['2026-10-02','2026-10-02','2026-10-08'],['2026-10-04','2026-10-02','2026-10-08'],['2026-12-31','2026-12-25','2026-12-31'],['2027-01-01','2027-01-01','2027-01-07'],['2028-02-29','2028-02-25','2028-03-02']]){
 const week=ministryWeek(today,[]);assert.equal(week.days[0].date,start);assert.equal(week.days[6].date,end);assert.equal(week.days.length,7);assert.equal(week.days[0].label,'週五');assert.equal(week.days[6].label,'週四');
}
const tasks=['2026-09-24','2026-09-25','2026-10-01','2026-10-02'].map((date,i)=>({id:String(i),areaId:'a',label:'map',date,status:i?'planned':'active'}));
const w=ministryWeek('2026-09-30',tasks);assert.equal(w.earlier[0].status,'active');assert.equal(w.days[0].tasks.length,1);assert.equal(w.days[6].tasks.length,1);assert.equal(w.later.length,1);assert.equal(tasks.length,4);
console.log('PASS: Friday/Thursday boundaries, month/year/leap-day rollover, overdue work, future plans and immutable inputs.');
