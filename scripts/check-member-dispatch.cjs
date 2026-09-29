const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,console,URL,require:n=>mocks[n]??require(n)});return exports}
let role='publisher',written=null;const fields={memberLineFields:{id:true,name:true,showInDispatch:true},memberFields:{id:true,name:true}};
const auth={requireApiUser:async()=>role==='admin'?{user:{role}}:{response:new Response('{}',{status:403})}};
const prisma={member:{findUnique:async()=>({id:'m1',email:'test@example.com',active:true}),update:async q=>{written=q.data;return q.data},create:async q=>{written=q.data;return q.data}}};
const update=load('src/app/api/members/[id]/route.ts',{'../../../../lib/db':{prisma},'../../../../lib/api-auth':auth,'../../../../lib/member-fields':fields});
const create=load('src/app/api/members/route.ts',{'../../../lib/db':{prisma},'../../../lib/api-auth':auth,'../../../lib/member-fields':fields,'bcryptjs':{hash:async()=> 'test-hash'}});
const req=body=>({json:async()=>body}),ctx={params:{id:'m1'}};
(async()=>{
 assert.equal((await update.PUT(req({name:'測試',showInDispatch:false}),ctx)).status,403);assert.equal(written,null);role='admin';
 for(const value of ['false',null,0]) assert.equal((await update.PUT(req({name:'測試',showInDispatch:value}),ctx)).status,400);
 assert.equal((await update.PUT(req({name:'測試',showInDispatch:false}),ctx)).status,200);assert.equal(written.showInDispatch,false);assert.equal(written.active,true);
 await update.PUT(req({name:'測試'}),ctx);assert(!('showInDispatch' in written),'omitted setting must remain unchanged');
 const body={name:'測試',email:'test@example.com',password:'abcdef'};
 assert.equal((await create.POST(req(body))).status,201);assert.equal(written.showInDispatch,true);
 await create.POST(req({...body,showInDispatch:false}));assert.equal(written.showInDispatch,false);
 assert.equal((await create.POST(req({...body,showInDispatch:'false'}))).status,400);
 console.log('PASS: admin-only setting, strict boolean, default visible, omitted update preserves setting, account activation unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1});
