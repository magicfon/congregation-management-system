const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Date,process,require:n=>mocks[n]??require(n)});return exports}
const dates=load('src/lib/google-sheets.ts'),allocation=load('src/lib/allocation.ts');let sent=0;
const client={botSite:'https://test',lineBotReady:()=>true,botText:text=>({text}),lineRequest:async()=>{sent++;return{accepted:true}}};
const service=load('src/lib/personal-territory-reminders.ts',{'./google-sheets':dates,'./allocation':allocation,'./line-bot-client':client});
const delivery=load('src/lib/line-notifications.ts',{'./personal-territory-reminders':service,'./line-bot-client':client});
const reviewed=new Date('2026-01-30T16:30:00Z'),now=new Date('2026-03-01T16:00:00Z');
let req={id:'r',status:'approved',memberId:'m',reviewedAt:reviewed,area:{name:'1',mapId:'nanzih',sheetNo:1,mapAreaId:1,personalTerritory:true,assignedMemberId:'m',dispatchedAt:reviewed,completedAt:null,lastReportedCompletedAt:null},member:{active:true,lineuid:'uid',lineNotificationsEnabled:true}},jobs=[];
const db={mapRequest:{findMany:async()=>req.member.active&&req.member.lineNotificationsEnabled?[req]:[],findUnique:async()=>req},member:{findUnique:async()=>req.member},lineNotification:{
 createMany:async({data})=>{if(jobs.some(j=>j.id===data[0].id))return{count:0};jobs.push({...data[0],status:'pending',attempts:0});return{count:1}},
 findMany:async()=>jobs.filter(j=>j.status==='pending'),
 updateMany:async({where,data})=>{const j=jobs.find(j=>j.id===where.id&&j.status===where.status);if(!j)return{count:0};Object.assign(j,data);return{count:1}},
 update:async({where,data})=>Object.assign(jobs.find(j=>j.id===where.id),data),
}};
(async()=>{
 assert.equal(service.personalDueDate(reviewed),'2026-03-02');assert.equal(service.personalReminderDue(req,new Date(now-1)),false);assert.equal(service.personalReminderDue(req,now),true);
 for(const patch of [{personalTerritory:false},{assignedMemberId:'other'},{dispatchedAt:new Date('2026-02-01')},{completedAt:new Date('2026-02-10')},{lastReportedCompletedAt:new Date('2026-01-31T00:00:00Z')}]){assert.equal(service.personalReminderDue({...req,area:{...req.area,...patch}},now),false)}
 assert.equal((await service.queuePersonalTerritoryReminders(db,now)).queued,1);assert.equal((await service.queuePersonalTerritoryReminders(db,now)).queued,0);assert.match(jobs[0].id,/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
 req.area.completedAt=now;await delivery.drainLineNotifications(db,undefined,now);assert.equal(sent,0);assert.equal(jobs[0].status,'cancelled');req.area.completedAt=null;
 jobs=[];req.member.lineNotificationsEnabled=false;assert.equal((await service.queuePersonalTerritoryReminders(db,now)).queued,0);req.member.lineNotificationsEnabled=true;
 await service.queuePersonalTerritoryReminders(db,now);await delivery.drainLineNotifications(db,undefined,now);assert.equal(sent,1);await delivery.drainLineNotifications(db,undefined,now);assert.equal(sent,1);
 console.log('PASS: 30 Taipei calendar days, boundary instant, returned/reassigned/reported exclusions, stable UUID dedup, delivery recheck, opt-out, one-time delivery');
})().catch(e=>{console.error(e);process.exitCode=1});
