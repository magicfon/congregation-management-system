const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let allowed=false, actorRole='admin', existingRole='publisher', others=0, writes=0;
const tx={member:{findUnique:async q=>q.where.id==='actor'?{role:actorRole,active:true,deletedAt:null}:{id:'target',email:'test@example.com',role:existingRole,active:true},count:async()=>others,update:async q=>{writes++;existingRole=q.data.role;return q.data}}};
const mocks={
 '../../../../lib/member-fields':{memberLineFields:{}},
 '../../../../lib/member-deletion':{},
 '../../../../lib/api-auth':{requireApiUser:async roles=>{assert.equal(roles[0],'admin');return allowed?{user:{id:'actor'}}:{response:new Response(null,{status:403})}}},
 '../../../../lib/db':{prisma:{$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');return fn(tx)}}},
};
const exported={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/members/[id]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exported,console,require:n=>mocks[n]||require(n)});
const call=body=>exported.PUT({json:async()=>({name:'Test',...body})},{params:{id:'target'}});
(async()=>{
 assert.equal((await call({role:'admin',expectedRole:'publisher'})).status,403);assert.equal(writes,0);
 allowed=true;assert.equal((await call({role:'root',expectedRole:'publisher'})).status,400);
 assert.equal((await call({role:'admin'})).status,400);
 actorRole='publisher';assert.equal((await call({role:'admin',expectedRole:'publisher'})).status,403);actorRole='admin';
 assert.equal((await call({role:'admin',expectedRole:'publisher'})).status,200);assert.equal(existingRole,'admin');
 assert.equal((await call({role:'publisher',expectedRole:'publisher'})).status,409);
 assert.equal((await call({role:'publisher',expectedRole:'admin'})).status,409);
 assert.equal((await call({active:false})).status,409);
 others=1;assert.equal((await call({role:'publisher',expectedRole:'admin'})).status,200);assert.equal(existingRole,'publisher');
 existingRole='elder';assert.equal((await call({phone:'123'})).status,200);assert.equal(existingRole,'elder');
 console.log('PASS: admin access, transaction authorization, allowed roles, stale role, last admin demotion/deactivation, successful role changes, legacy role preserved.');
})().catch(e=>{console.error(e);process.exitCode=1});
