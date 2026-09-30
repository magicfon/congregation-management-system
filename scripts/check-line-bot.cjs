// All transport/database operations are mocked. No real messages are sent.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript'),crypto=require('crypto');
const env={LINE_BOT_ENABLED:'true',LINE_BOT_SAME_PROVIDER:'true',LINE_BOT_CHANNEL_SECRET:'test-secret',LINE_BOT_ACCESS_TOKEN:'test-token'};
let transportStatus=200,sends=[];
const fetch=async(url,options)=>{sends.push({url,options});return {ok:transportStatus===200,status:transportStatus,headers:new Headers(transportStatus===409?{'x-line-accepted-request-id':'accepted'}:{})}};
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Buffer,console,Date,Headers,AbortSignal,fetch,process:{env},require:n=>mocks[n]??require(n)});return exports}
const client=load('src/lib/line-bot-client.ts');
const notify=load('src/lib/line-notifications.ts',{'./line-bot-client':client});
const allocation=load('src/lib/allocation.ts'),week=load('src/lib/ministry-week.ts');
const ministry=load('src/lib/ministry.ts',{'./line-notifications':notify,'./line-bot-client':client,'./allocation':allocation});
const dates={taipeiDate:d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
const queries=load('src/lib/line-bot-queries.ts',{'./pending-line-identities':{pendingLineMessage:'待管理員確認權限，等待配對',recordPendingLineIdentity:async()=>{}},'./line-bot-client':client,'./allocation':allocation,'./ministry':ministry,'./ministry-week':week,'./google-sheets':dates});
const now=new Date('2026-09-30T04:00:00Z');
let jobs=[],member={id:'m',active:true,lineuid:'Utest',lineNotificationsEnabled:true};
const db={member:{findUnique:async()=>member},lineNotification:{
 create:async({data})=>jobs.push({status:'pending',attempts:0,nextAttemptAt:new Date(now),createdAt:new Date(now),...data}),
 findMany:async({where})=>jobs.filter(j=>j.status===where.status&&j.nextAttemptAt<=where.nextAttemptAt.lte),
 updateMany:async({where,data})=>{const j=jobs.find(j=>j.id===where.id&&j.status===where.status&&j.nextAttemptAt<=where.nextAttemptAt.lte);if(!j)return{count:0};j.attempts++;j.nextAttemptAt=data.nextAttemptAt;return{count:1}},
 update:async({where,data})=>Object.assign(jobs.find(j=>j.id===where.id),data)
}};
(async()=>{
 const raw=Buffer.from('{"events":[]}'),sig=crypto.createHmac('sha256',env.LINE_BOT_CHANNEL_SECRET).update(raw).digest('base64');
 assert(client.verifyLineSignature(raw,sig,env.LINE_BOT_CHANNEL_SECRET));assert(!client.verifyLineSignature(Buffer.from('{}'),sig,env.LINE_BOT_CHANNEL_SECRET));assert(!client.verifyLineSignature(raw,'bad',env.LINE_BOT_CHANNEL_SECRET));
 env.LINE_BOT_SAME_PROVIDER='false';assert(!client.lineBotReady());assert.equal(await notify.queueLineNotification(db,'m','test',now),null);env.LINE_BOT_SAME_PROVIDER='true';
 await notify.queueLineNotification(db,'m','test',now);const id=jobs[0].id;assert.match(id,/^[a-f0-9-]{36}$/);
 transportStatus=500;let result=await notify.drainLineNotifications(db,undefined,now);assert.equal(result.deferred,1);assert.equal(jobs[0].status,'pending');assert.equal(sends[0].options.headers['X-Line-Retry-Key'],id);
 transportStatus=409;result=await notify.drainLineNotifications(db,undefined,new Date(now.getTime()+120000));assert.equal(result.accepted,1);assert.equal(sends[1].options.headers['X-Line-Retry-Key'],id);assert.equal(sends[0].options.body,sends[1].options.body);
 await notify.queueLineNotification(db,'m','second',now);member={...member,lineuid:'Uchanged'};const before=sends.length;await notify.drainLineNotifications(db,undefined,now);assert.equal(sends.length,before);assert.equal(jobs[1].lastError,'binding_changed');
 member={...member,lineuid:'Utest'};await notify.queueLineNotification(db,'m','third',now);await notify.drainLineNotifications(db,undefined,new Date(now.getTime()+24*3600000));assert.equal(jobs[2].lastError,'expired');
 await notify.queueLineNotification(db,'m','fourth',now);transportStatus=401;await notify.drainLineNotifications(db,undefined,now);assert.equal(jobs[3].lastError,'HTTP 401');
 member.lineNotificationsEnabled=false;assert.equal(await notify.queueLineNotification(db,'m','muted',now),null);
 member.lineNotificationsEnabled=true;await notify.queueLineNotification(db,'m','queued before mute',now);member.lineNotificationsEnabled=false;const mutedSends=sends.length;await notify.drainLineNotifications(db,undefined,now);assert.equal(sends.length,mutedSends);assert.equal(jobs.at(-1).status,'cancelled');member.lineNotificationsEnabled=true;
 let reads=0;const area={id:'a',name:'A',mapId:'nanzih',mapAreaId:1,sheetNo:1,assignedMemberId:'m',dispatchedAt:new Date('2026-09-01'),completedAt:null,ministryVisits:[]};
 const queryDb={member:{findUnique:async({where})=>{assert.equal(where.lineuid,'Utest');return member}},area:{findMany:async({where})=>{reads++;assert.equal(where.assignedMemberId,'m');return[area]}},ministryVisit:{findMany:async({where})=>{assert.equal(where.publisherId,'m');return[{id:'v',areaId:'a',area,status:'active',cycleKey:ministry.ministryCycle(area),scheduledDate:'2026-09-30'}]}}};
 queryDb.pendingLineIdentity={findUnique:async()=>({displayName:'新人'})};
 assert.match(await queries.lineBotAnswer(queryDb,'Utest','本週行程',now),/2026-09-30/);assert.match(await queries.lineBotAnswer(queryDb,'Utest','我的地圖',now),/1 張/);member=null;assert.match(await queries.lineBotAnswer(queryDb,'Utest','我的地圖',now),/配對/);assert.equal(reads,1);
 let answers=0;const webhook=load('src/app/api/line-bot/webhook/route.ts',{'../../../../lib/db':{prisma:{}},'../../../../lib/line-bot-client':client,'../../../../lib/line-bot-queries':{lineBotAnswer:async()=>{answers++;return'test'}}});
 const request=payload=>{const b=JSON.stringify(payload);return new Request('https://example.test/api/line-bot/webhook',{method:'POST',body:b,headers:{'x-line-signature':crypto.createHmac('sha256',env.LINE_BOT_CHANNEL_SECRET).update(b).digest('base64')}})};
 assert.equal((await webhook.POST(new Request('https://example.test',{method:'POST',body:'{}'}))).status,401);
 assert.equal((await webhook.POST(request({events:[]}))).status,200);
 transportStatus=200;await webhook.POST(request({events:[{source:{type:'group',userId:'Utest'},replyToken:'test',type:'message',message:{type:'text',text:'我的地圖'}}]}));assert.equal(answers,0);
 await webhook.POST(request({events:[{source:{type:'user',userId:'Utest'},replyToken:'test',type:'message',message:{type:'text',text:'我的地圖'}}]}));assert.equal(answers,1);
 let actorId='self',setting=true,cancelled=false;
 const preferenceDb={member:{findUnique:async({where})=>{assert.equal(where.id,'self');return{active:true,lineuid:'uid',lineNotificationsEnabled:setting}}},$transaction:async fn=>fn({member:{updateMany:async({where,data})=>{assert.equal(where.id,'self');assert.equal(where.active,true);setting=data.lineNotificationsEnabled;return{count:1}}},lineNotification:{updateMany:async({where,data})=>{assert.equal(where.memberId,'self');assert.equal(where.status,'pending');assert.equal(data.status,'cancelled');cancelled=true}}})};
 const preferences=load('src/app/api/me/line-notifications/route.ts',{'../../../../lib/db':{prisma:preferenceDb},'../../../../lib/api-auth':{requireApiUser:async()=>actorId?{user:{id:actorId}}:{response:new Response('{}',{status:401})}}});
 assert.equal((await(await preferences.GET()).json()).enabled,true);
 const prefRequest=b=>new Request('https://example.test',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
 assert.equal((await preferences.PATCH(prefRequest({enabled:false,memberId:'forged'}))).status,200);assert.equal(setting,false);assert(cancelled);
 assert.equal((await preferences.PATCH(prefRequest({enabled:'false'}))).status,400);actorId=null;assert.equal((await preferences.GET()).status,401);
 console.log('PASS: signature tamper rejection, disabled/provider gates, durable retries with fixed payload/key, UID changes, expiry, permanent failure, personal queries, private-only webhook.');
})().catch(e=>{console.error(e);process.exitCode=1});
