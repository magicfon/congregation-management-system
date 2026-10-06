// Isolated auth regression; no real LINE or database calls.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const env={LINE_CLIENT_ID:'123',LINE_LIFF_ID:'123-test'};
const uid='U'+'a'.repeat(32);
let identity,status=200,networkFails=false,pending=[],updates=[],member;
function load(file,mocks={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,process:{env},URLSearchParams,Date,AbortSignal,fetch:async(url,options)=>{
  assert.equal(url,'https://api.line.me/oauth2/v2.1/verify');assert.equal(options.body.get('client_id'),'123');assert.equal(options.body.get('id_token'),'raw-token');
  if(networkFails)throw Error('network');return new Response(JSON.stringify(identity),{status});
 },require:n=>mocks[n]??require(n)});return exports;
}
const settings=load('src/lib/liff-settings.ts');
const db={member:{findUnique:async()=>member,update:async({data})=>updates.push(data)}};
const pendingMock={recordPendingLineIdentity:async(_db,uid,name)=>pending.push({uid,name})};
const auth=load('src/lib/liff-auth.ts',{'./liff-settings':settings,'./pending-line-identities':pendingMock});
function reset(){identity={iss:'https://access.line.me',aud:'123',sub:uid,exp:Date.now()/1000+300,name:'LINE Name'};status=200;networkFails=false;pending=[];updates=[];member={id:'m1',name:'Real Name',email:'internal@members.invalid',role:'publisher',active:true,lineuid:uid};}
(async()=>{
 reset();assert.equal(settings.configuredLiffId(),'123-test');env.LINE_LIFF_ID='456-other';assert.equal(settings.configuredLiffId(),null);assert.equal(await auth.authorizeLiff(db,'raw-token'),null);env.LINE_LIFF_ID='123-test';
 assert.equal(settings.liffDestination('https://evil.test'),'/dashboard');assert.equal(settings.liffDestination('week'),'/dashboard?view=week');assert.equal(settings.liffDestination('bulletin'),'/bulletin');
 const user=await auth.authorizeLiff(db,'raw-token');assert.equal(user.id,'m1');assert.equal(user.name,'Real Name');assert.equal(user.role,'publisher');assert.equal(user.lineUid,uid);assert.equal(updates[0].lineDisplayName,'LINE Name');
 for(const [key,value] of [['aud','456'],['iss','https://evil.test'],['exp',0],['sub','forged']]) {reset();identity[key]=value;assert.equal(await auth.authorizeLiff(db,'raw-token'),null);assert.equal(updates.length,0);assert.equal(pending.length,0);}
 reset();status=400;assert.equal(await auth.authorizeLiff(db,'raw-token'),null);assert.equal(updates.length,0);
 reset();networkFails=true;await assert.rejects(auth.authorizeLiff(db,'raw-token'),/LiffUnavailable/);assert.equal(pending.length,0);
 reset();member=null;await assert.rejects(auth.authorizeLiff(db,'raw-token'),/LinePending/);assert.equal(pending[0].uid,uid);assert.equal(pending[0].name,'LINE Name');assert.equal(updates.length,0);
 for(const change of [{active:false},{deletedAt:new Date()}]){reset();Object.assign(member,change);assert.equal(await auth.authorizeLiff(db,'raw-token'),null);assert.equal(updates.length,0);}
 reset();const options=load('src/lib/auth.ts',{'./db':{prisma:db},'./liff-settings':settings,'./liff-auth':auth,'./pending-line-identities':pendingMock}).authOptions;
 assert(options.providers.some(p=>p.options?.id==='liff'));
 const token=await options.callbacks.jwt({token:{sub:'m1'},user,account:{provider:'liff'}});assert.equal(token.lineUid,uid);assert.equal(token.id,'m1');
 member.lineuid=null;const revoked=await options.callbacks.jwt({token});assert.equal(revoked.id,undefined);assert.equal(revoked.role,undefined);
 console.log('PASS: LINE server verification, audience/expiry/issuer, pending identities, inactive/deleted members, LIFF session revocation, fixed destinations.');
})().catch(e=>{console.error(e);process.exitCode=1});
