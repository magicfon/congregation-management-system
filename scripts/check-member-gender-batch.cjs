const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
let allowed = true, actorRole = 'admin', calls = 0;
let members = [{id:'a',gender:'unspecified',deletedAt:null},{id:'b',gender:'brother',deletedAt:null},{id:'c',gender:'unspecified',deletedAt:null}];
const prisma = {$transaction:async (fn,options)=>{
 assert.equal(options.isolationLevel,'Serializable');
 const draft = members.map(m=>({...m}));
 await fn({member:{findUnique:async()=>({role:actorRole,active:true,deletedAt:null}),updateMany:async q=>{
  calls++;let count=0;for(const member of draft) if(q.where.id.in.includes(member.id)&&member.gender===q.where.gender&&member.deletedAt===null){member.gender=q.data.gender;count++;}return {count};
 }}});members=draft;
}};
const mocks={'@/lib/db':{prisma},'@/lib/api-auth':{requireApiUser:async roles=>{assert.deepEqual(Array.from(roles),['admin']);return allowed?{user:{id:'actor'}}:{response:new Response(null,{status:403})}}}};
const exportsObj={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/members/gender-batch/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObj,console,require:n=>mocks[n]||require(n)});
const change=(id,gender,expectedGender='unspecified')=>({id,gender,expectedGender});
const call=changes=>exportsObj.PATCH({json:async()=>({changes})});
(async()=>{
 allowed=false;assert.equal((await call([change('a','sister')])).status,403);assert.equal(calls,0);allowed=true;
 for(const changes of [[],null,[change('a','invalid')],[change('a','sister'),change('a','brother')],[{id:'a',gender:'sister'}]])assert.equal((await call(changes)).status,400);
 assert.equal(calls,0);
 actorRole='publisher';assert.equal((await call([change('a','sister')])).status,403);actorRole='admin';
 const before=JSON.stringify(members);
 assert.equal((await call([change('a','brother'),change('b','sister')])).status,409);assert.equal(JSON.stringify(members),before,'conflict must roll back earlier group');
 assert.equal((await call([change('missing','sister')])).status,409);
 calls=0;assert.equal((await call([change('a','sister'),change('c','sister'),change('b','unspecified','brother')])).status,200);
 assert.equal(calls,2,'same changes use one grouped write');assert.deepEqual(members.map(m=>m.gender),['sister','unspecified','sister']);
 console.log('PASS: admin-only batch, validation, duplicate IDs, stale values, rollback, missing IDs and grouped writes');
})().catch(e=>{console.error(e);process.exitCode=1});
