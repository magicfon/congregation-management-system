// Real registration, OAuth, bot and approval code against an isolated transactional DB.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,
    {exports,process,Date,console,require:n=>mocks[n]??require(n)});
  return exports;
}
const uid='U'+'a'.repeat(32), pairing=load('src/lib/line-pairing.ts',{'./line-pairing-notification':{queuePairingNotice:async()=>null}});
const service=load('src/lib/pending-line-identities.ts',{'./line-pairing':pairing,'./line-pairing-notification':{queuePairingNotice:async()=>null}});
let people, identities, failDelete=false;
function reset(){people=[{id:'m',name:'成員',active:true,role:'elder',lineuid:null}];identities=[];failDelete=false}
const match=(row,where)=>Object.entries(where).every(([k,v])=>row[k]===v);
const db={member:{
  create:async({data})=>{const row={id:'created',...data};people.push(row);return row;},
  findUnique:async({where})=>people.find(r=>match(r,where))||null,
  update:async({where,data})=>Object.assign(people.find(r=>match(r,where)),data),
},pendingLineIdentity:{
  findUnique:async({where})=>identities.find(r=>match(r,where))||null,
  upsert:async({where,create,update})=>{let row=identities.find(r=>match(r,where));if(row)Object.assign(row,update);else identities.push({...create});},
  delete:async({where})=>{if(failDelete)throw Error('rollback');identities=identities.filter(r=>!match(r,where));},
  findMany:async()=>identities,
},$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');const snapshot=structuredClone([people,identities]);try{return await fn(db)}catch(e){[people,identities]=snapshot;throw e}}};
(async()=>{
 reset(); await assert.rejects(service.recordPendingLineIdentity(db,'bad','name'));assert.equal(identities.length,0);
 await service.recordPendingLineIdentity(db,uid,'暱稱');await service.recordPendingLineIdentity(db,uid,null);
 assert.equal(identities.length,1);assert.equal(identities[0].displayName,'暱稱');assert.equal(people.length,1);
 await service.recordPendingLineIdentity(db,uid,'新暱稱');assert.equal(identities[0].displayName,'新暱稱');
 const auth=load('src/lib/auth.ts',{'./db':{prisma:db},'./pending-line-identities':service}).authOptions.callbacks;
 const account={provider:'line',providerAccountId:uid};
 assert.equal(await auth.signIn({account,profile:{name:'OAuth暱稱'}}),'/pending-access');assert.equal(people.length,1);
 assert.equal((await auth.jwt({token:{sub:uid},account})).id,undefined);
 let profileCalls=0, reads=0;
 const queries=load('src/lib/line-bot-queries.ts',{'./pending-line-identities':service,'./line-bot-client':{botSite:'https://test',lineDisplayName:async()=>{profileCalls++;return null}},'./allocation':{},'./ministry':{},'./ministry-week':{},'./google-sheets':{}});
 db.area={findMany:async()=>{reads++;throw Error('must not read private data')}};
 assert.match(await queries.lineBotAnswer(db,uid,'我的地圖'),/待管理員確認權限/);assert.equal(reads,0);assert.equal(profileCalls,0);
 const unknown='U'+'b'.repeat(32);assert.match(await queries.lineBotAnswer(db,unknown,'我的地圖'),/待管理員/);assert.equal(profileCalls,1);assert(identities.some(r=>r.uid===unknown));
 for(const state of ['occupied','inactive','uid-bound']){
  const original=structuredClone(people);
  if(state==='occupied')people[0].lineuid='different';
  if(state==='inactive')people[0].active=false;
  if(state==='uid-bound')people.push({id:'other',lineuid:uid});
  await assert.rejects(service.linkPendingLineIdentity(db,uid,'m'));assert(identities.some(r=>r.uid===uid));people=original;
 }
 failDelete=true;await assert.rejects(service.linkPendingLineIdentity(db,uid,'m'),/rollback/);assert.equal(people[0].lineuid,null);failDelete=false;
 await service.linkPendingLineIdentity(db,uid,'m');assert.equal(people[0].role,'elder');assert.equal(people[0].name,'成員');assert.equal(people[0].lineuid,uid);
 assert(!identities.some(r=>r.uid===uid));await assert.rejects(service.linkPendingLineIdentity(db,uid,'m'));
 await service.recordPendingLineIdentity(db,uid,'late-event');assert(!identities.some(r=>r.uid===uid));
 assert.equal(await auth.signIn({account,profile:{name:'新名稱'}}),true);assert.equal((await auth.jwt({token:{sub:uid},account})).role,'elder');
 people[0].active=false;assert.equal(await auth.signIn({account,profile:{name:'test'}}),false);assert.match(await queries.lineBotAnswer(db,uid,'我的地圖'),/停用/);
 let role='publisher';const route=load('src/app/api/members/pending-line/route.ts',{'../../../../lib/line-pairing-notification':{deliverPairingNotice:async()=>''},'../../../../lib/db':{prisma:db},'../../../../lib/pending-line-identities':service,'../../../../lib/line-pairing':pairing,'../../../../lib/api-auth':{requireApiUser:async roles=>{assert.equal(roles[0],'admin');return role==='admin'?{user:{id:'admin'}}:{response:new Response(null,{status:403})}}}});
 assert.equal((await route.GET()).status,403);assert.equal((await route.POST({})).status,403);
 role='admin';assert.equal((await route.GET()).status,200);assert.equal((await route.POST({json:async()=>({uid:'bad',targetId:'m'})})).status,400);
 reset();people.push({id:'admin',active:true,role:'admin'});await service.recordPendingLineIdentity(db,uid,'新使用者');
 const create=body=>route.POST({json:async()=>({action:'create',uid,name:'新成員',role:'publisher',...body})});
 role='publisher';assert.equal((await create({})).status,403);role='admin';
 assert.equal((await create({role:'elder'})).status,400);assert.equal((await create({name:' '})).status,400);assert.equal((await create({targetId:'m'})).status,400);
 failDelete=true;assert.equal((await create({})).status,503);assert.equal(people.length,2);assert.equal(identities.length,1);failDelete=false;
 const created=await create({});assert.equal(created.status,200);assert.equal(people.length,3);assert.equal(identities.length,0);
 const member=people.find(p=>p.id==='created');assert.equal(member.role,'publisher');assert.equal(member.lineuid,uid);assert.equal(member.lineDisplayName,'新使用者');assert.match(member.email,/@members.invalid$/);assert.match(member.password,/^\$2/);
 assert.equal((await create({})).status,409);assert.equal(people.length,3);
 assert.equal(await auth.signIn({account,profile:{name:'LINE'}}),true);assert.equal((await auth.jwt({token:{sub:uid},account})).role,'publisher');
 reset();people.push({id:'admin',active:true,role:'admin'});await service.recordPendingLineIdentity(db,uid,'新使用者');assert.equal((await create({role:'admin'})).status,200);assert.equal(people.find(p=>p.id==='created').role,'admin');
 console.log('PASS: unknown UID registration, dedup/profile fallback, no automatic member/session/private reads, admin-only list/link, conflict/rollback, retained role, login after approval, disabled member, delayed event.');
})().catch(e=>{console.error(e);process.exitCode=1});
