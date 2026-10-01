const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,Date,require:n=>mocks[n]??require(n)});return exports}
let sent=0,jobs=[],members,failQueue=false,failDelivery=false;
const client={botSite:'https://example.test',lineBotReady:()=>true,botText:text=>({text}),lineRequest:async()=>{sent++;return{accepted:true,status:200}}};
const notifications=load('src/lib/line-notifications.ts',{'./line-bot-client':client});
const notice=load('src/lib/line-pairing-notification.ts',{'./line-bot-client':client,'./line-notifications':{...notifications,drainLineNotifications:async(db,ids)=>{if(failDelivery)throw Error('offline');return notifications.drainLineNotifications(db,ids)}}});
const pairing=load('src/lib/line-pairing.ts',{'./line-pairing-notification':notice});
const pending=load('src/lib/pending-line-identities.ts',{'./line-pairing':pairing,'./line-pairing-notification':notice});
const uid='U'+'a'.repeat(32);
let identities;
function reset(){jobs=[];sent=0;failQueue=false;failDelivery=false;members=[{id:'source',name:'來源',lineuid:uid,active:true,lineNotificationsEnabled:true},{id:'target',name:'配對姓名',lineuid:null,active:true,lineNotificationsEnabled:true}];identities=[{uid,displayName:'暱稱'}]}
const db={member:{findUnique:async({where})=>structuredClone(members.find(m=>Object.entries(where).every(([k,v])=>m[k]===v))),update:async({where,data})=>Object.assign(members.find(m=>m.id===where.id),data)},
 pendingLineIdentity:{findUnique:async()=>identities[0],delete:async()=>{identities=[]}},
 lineNotification:{create:async({data})=>{if(failQueue)throw Error('outbox failed');jobs.push({status:'pending',nextAttemptAt:new Date(),attempts:0,...data})},findMany:async({where})=>jobs.filter(j=>j.status==='pending'&&where.id.in.includes(j.id)),updateMany:async({where,data})=>{const j=jobs.find(j=>j.id===where.id&&j.status==='pending');if(!j)return{count:0};j.nextAttemptAt=data.nextAttemptAt;j.attempts++;return{count:1}},update:async({where,data})=>Object.assign(jobs.find(j=>j.id===where.id),data)},
 $transaction:async fn=>{const snapshot=structuredClone([members,jobs,identities]);try{return await fn(db)}catch(e){[members,jobs,identities]=snapshot;throw e}},};
(async()=>{
 reset();const result=await pairing.pairLineMember(db,'source','target',uid);assert.equal(jobs.length,1);assert.equal(sent,0);assert.equal(jobs[0].lineUid,uid);assert.match(jobs[0].text,/已完成確認/);assert.match(jobs[0].text,/配對姓名/);
 assert.match(await notice.deliverPairingNotice(db,result.notificationId),/已接受/);assert.equal(sent,1);await notice.deliverPairingNotice(db,result.notificationId);assert.equal(sent,1);
 reset();members[1].lineNotificationsEnabled=false;assert.equal((await pairing.pairLineMember(db,'source','target',uid)).notificationId,null);assert.equal(jobs.length,0);
 reset();members[0].lineNotificationsEnabled=false;assert.equal((await pairing.pairLineMember(db,'source','target',uid)).notificationId,null);assert.equal(members[1].lineNotificationsEnabled,false);assert.equal(jobs.length,0);
 reset();failQueue=true;await assert.rejects(pairing.pairLineMember(db,'source','target',uid),/outbox/);assert.equal(members[0].lineuid,uid);assert.equal(members[1].lineuid,null);assert.equal(sent,0);
 reset();members[0].lineuid=null;const approved=await pending.linkPendingLineIdentity(db,uid,'target');assert.equal(identities.length,0);assert.equal(jobs.length,1);failDelivery=true;assert.match(await notice.deliverPairingNotice(db,approved.notificationId),/待重試/);assert.equal(members[1].lineuid,uid);
 failDelivery=false;members[1].lineNotificationsEnabled=false;await notice.deliverPairingNotice(db,approved.notificationId);assert.equal(sent,0);assert.equal(jobs[0].status,'cancelled');
 console.log('PASS: both pairing flows enqueue transactionally, rollback on outbox failure, delivery failure preserves pairing, stable one-time delivery, notification opt-out before enqueue and send.');
})().catch(e=>{console.error(e);process.exitCode=1});

