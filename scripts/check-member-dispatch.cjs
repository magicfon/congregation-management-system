const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,console,URL,require:n=>mocks[n]??require(n)});return exports}
let role='publisher',written=null;const fields={memberLineFields:{id:true,name:true,showInDispatch:true},memberFields:{id:true,name:true}};
const auth={requireApiUser:async()=>role==='admin'?{user:{id:'actor',role}}:{response:new Response('{}',{status:403})}};
const prisma={member:{findUnique:async q=>q.where.id==='actor'?{id:'actor',role:'admin',active:true,deletedAt:null}:{id:'m1',email:'test@example.com',role:'publisher',active:true},update:async q=>{written=q.data;return q.data},create:async q=>{written=q.data;return q.data}}};
prisma.member.updateMany=async q=>{written=q.data;assert.equal(q.where.deletedAt,null);return {count:1}};
prisma.$transaction=async fn=>fn(prisma);
const update=load('src/app/api/members/[id]/route.ts',{'../../../../lib/member-deletion':{},'../../../../lib/line-rich-menu':{syncMemberRichMenus:async()=>{},syncMemberRichMenusById:async()=>{}},'../../../../lib/db':{prisma},'../../../../lib/api-auth':auth,'../../../../lib/member-fields':fields});
const create=load('src/app/api/members/route.ts',{'../../../lib/allocation':{},'../../../lib/db':{prisma},'../../../lib/api-auth':auth,'../../../lib/member-fields':fields,'bcryptjs':{hash:async()=> 'test-hash'}});
const req=body=>({json:async()=>body}),ctx={params:{id:'m1'}};
(async()=>{
 assert.equal((await update.PUT(req({name:'測試',showInDispatch:false}),ctx)).status,403);assert.equal(written,null);role='admin';
 for(const value of ['false',null,0]) assert.equal((await update.PUT(req({name:'測試',showInDispatch:value}),ctx)).status,400);
 assert.equal((await update.PUT(req({name:'測試',showInDispatch:false}),ctx)).status,200);assert.equal(written.showInDispatch,false);assert.equal(written.active,true);
 await update.PUT(req({name:'測試'}),ctx);assert(!('showInDispatch' in written),'omitted setting must remain unchanged');
 const body={name:'測試'};
 assert.equal((await create.POST(req(body))).status,201);assert.equal(written.showInDispatch,true);assert.match(written.email,/^line-[a-f0-9-]+@members\.invalid$/);assert(written.password);
 const firstEmail=written.email;await create.POST(req(body));assert.notEqual(written.email,firstEmail);
 for(const name of ['',null,123])assert.equal((await create.POST(req({name}))).status,400);
 await create.POST(req({...body,showInDispatch:false}));assert.equal(written.showInDispatch,false);
 assert.equal((await create.POST(req({...body,showInDispatch:'false'}))).status,400);
 for (const gender of ['sister','brother','unspecified']) {
  assert.equal((await create.POST(req({...body,gender}))).status,201);assert.equal(written.gender,gender);
  assert.equal((await update.PUT(req({name:'測試',gender}),ctx)).status,200);assert.equal(written.gender,gender);
 }
 for (const gender of [null,1,'invalid',{}]) {
  assert.equal((await create.POST(req({...body,gender}))).status,400);
  assert.equal((await update.PUT(req({name:'測試',gender}),ctx)).status,400);
 }
 await create.POST(req(body));assert.equal(written.gender,'unspecified');
 await update.PUT(req({name:'測試'}),ctx);assert(!('gender' in written));
 role='publisher';written=null;
 assert.equal((await update.PATCH(req({gender:'sister'}),ctx)).status,403);assert.equal(written,null);
 role='admin';
 for(const gender of ['brother','sister','unspecified']) {
  assert.equal((await update.PATCH(req({gender}),ctx)).status,200);
  assert.equal(written.gender,gender);assert.deepEqual(Object.keys(written),['gender']);
 }
 for(const body of [{},{gender:null},{gender:'invalid'},{gender:'sister',showInDispatch:'false'}]) assert.equal((await update.PATCH(req(body),ctx)).status,400);
 assert.equal((await update.PATCH(req({showInDispatch:false}),ctx)).status,200);assert.deepEqual(Object.keys(written),['showInDispatch']);
 console.log('PASS: inline admin-only gender updates, omitted fields preserved; gender choices, invalid values, default and omitted update; admin-only setting, strict boolean, default visible, omitted update preserves setting, account activation unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1});
