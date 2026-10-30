// No external calls: runs real publish/notification flows with mocked LINE and DB.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),sharp=require('sharp');
const env={LINE_BOT_ENABLED:'true',LINE_BOT_SAME_PROVIDER:'true',LINE_BOT_CHANNEL_SECRET:'secret',LINE_BOT_ACCESS_TOKEN:'token'};
let current=null,remote=new Set(),images=new Set(),uploadFails=false,setTimeoutOnce=false,createCount=0,publishCount=0,rows=[],members=[],bulk=[],userLinks={};
const ids=['a','c','d'].map(c=>'richmenu-'+c.repeat(32)),menuId=ids[0],otherId='richmenu-'+'b'.repeat(32);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function transport(url,options){
 const method=options.method||'GET';assert.equal(options.headers.Authorization,'Bearer token');
 if(url.endsWith('/user/all/richmenu'))return current?json({richMenuId:current}):json({},404);
 if(url.endsWith('/richmenu')&&method==='POST'){const id=ids[createCount++];remote.add(id);return json({richMenuId:id})}
 if(url.endsWith('/richmenu/bulk/link')){bulk.push(JSON.parse(options.body));return json({},202)}
 const user=url.match(/\/user\/(U\w+)\/richmenu(?:\/(richmenu-\w+))?$/);
 if(user){if(method==='DELETE'){delete userLinks[user[1]];return json({})}userLinks[user[1]]=user[2];return json({})}
 const all=url.match(/\/user\/all\/richmenu\/(richmenu-\w+)$/);
 if(all){publishCount++;current=all[1];if(setTimeoutOnce){setTimeoutOnce=false;throw Error('response lost')}return json({})}
 const content=url.match(/\/richmenu\/(richmenu-\w+)\/content$/);
 if(content){
  if(method==='GET')return images.has(content[1])?new Response('image'):json({},404);
  assert.equal(options.headers['Content-Type'],'image/png');assert(options.body.length>100);if(uploadFails)return json({},500);images.add(content[1]);return json({});
 }
 const menu=url.match(/\/richmenu\/(richmenu-\w+)$/);
 if(menu)return remote.has(menu[1])?json({richMenuId:menu[1]}):json({},404);
 throw Error('Unexpected request '+url);
}
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,process:{env,cwd:()=>process.cwd()},Date,Buffer,Uint8Array,AbortSignal,URL,Headers,fetch:transport,require:n=>mocks[n]??require(n)});return exports}
const client=load('src/lib/line-bot-client.ts');
const settings=load('src/lib/liff-settings.ts');
const menu=load('src/lib/line-rich-menu.ts',{'./line-bot-client':client,'./liff-settings':{...settings,configuredLiffId:()=>null}});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const matches=(r,w)=>Object.entries(w).every(([k,v])=>r[k]===v);
const db={member:{
 findMany:async({where})=>members.filter(m=>where.lineuid.in?where.lineuid.in.includes(m.lineuid):m.lineuid&&m.active&&!m.deletedAt),
},setting:{
 findUnique:async({where})=>rows.find(r=>matches(r,where))||null,
 findMany:async({where})=>rows.filter(r=>where.key.in.includes(r.key)),
 create:async({data})=>{if(rows.some(r=>r.key===data.key))throw Error('duplicate');rows.push({...data})},
 updateMany:async({where,data})=>{const r=rows.find(r=>matches(r,where));if(r)Object.assign(r,data);return{count:r?1:0}},
 upsert:async({where,create,update})=>{const r=rows.find(r=>matches(r,where));if(r)Object.assign(r,update);else rows.push({...create})},
 deleteMany:async({where})=>{rows=rows.filter(r=>!matches(r,where))},
}};
function reset(){current=null;remote=new Set();images=new Set();uploadFails=false;setTimeoutOnce=false;createCount=0;publishCount=0;rows=[];members=[];bulk=[];userLinks={}}
const uid=c=>'U'+c.repeat(32);
const member=(c,role,gender,extra={})=>({lineuid:uid(c),role,gender,active:true,deletedAt:null,...extra});
(async()=>{
 for(const [kind,count] of [['sister',4],['brother',menu.SHOW_HANDOFFS?6:5],['admin',menu.SHOW_HANDOFFS?7:6]]){
  const def=menu.menuDefinitions[kind],meta=await sharp(`public/line/rich-menu-${kind}.png`).metadata();
  assert.equal(meta.width,def.size.width);assert.equal(meta.height,def.size.height);assert(fs.statSync(`public/line/rich-menu-${kind}.png`).size<1000000);
  assert.equal(def.areas.length,count);assert(def.size.width/def.size.height>=1.45);
  for(const row of [0,337]){const cells=def.areas.filter(a=>a.bounds.y===row);assert.equal(cells.reduce((s,a)=>s+a.bounds.width,0),def.size.width,`${kind} row fills width`)}
  assert.equal(def.areas[kind==='sister'?2:2].action.text,'我的委派');
 }
 const uris=kind=>menu.menuDefinitions[kind].areas.filter(a=>a.action.type==='uri').map(a=>a.action.uri.slice(client.botSite.length));
 same(uris('sister'),['/bulletin','/dashboard','/area-status']);
 const h=menu.SHOW_HANDOFFS?['/dashboard?view=handoffs']:[];
 same(uris('brother'),['/bulletin','/dashboard','/area-status',...h,'/bulletin/territory-report']);
 same(uris('admin'),['/bulletin','/dashboard','/area-status',...h,'/bulletin/territory-report','/dashboard?view=manage']);
 const liffMenu=load('src/lib/line-rich-menu.ts',{'./line-bot-client':client,'./liff-settings':{...settings,configuredLiffId:()=> '123-test'}});assert(Object.values(liffMenu.menuDefinitions).every(d=>d.areas.filter(a=>a.action.type==='uri').every(a=>new URL(a.action.uri).origin==='https://liff.line.me')));
 assert.equal(menu.memberMenuKind(member('1','admin','sister')),'admin');assert.equal(menu.memberMenuKind(member('1','publisher','brother')),'brother');assert.equal(menu.memberMenuKind(member('1','elder','brother')),'brother');
 assert.equal(menu.memberMenuKind(member('1','publisher','unspecified')),'sister');assert.equal(menu.memberMenuKind(member('1','admin','brother',{active:false})),'sister');assert.equal(menu.memberMenuKind(member('1','admin','brother',{deletedAt:new Date()})),'sister');assert.equal(menu.memberMenuKind(null),'sister');

 reset();current=otherId;rows.push({key:'line_rich_menu_v4',value:otherId});assert.equal((await menu.richMenuStatus(db)).installed,false);await menu.publishRichMenu(db,otherId);assert.equal(createCount,3);assert.equal(current,ids[0]);assert(rows.some(row=>row.key==='line_rich_menu_v5_admin'&&row.value===ids[2]));
 reset();members=[member('1','publisher','sister'),member('2','publisher','brother'),member('3','admin','sister'),member('4','publisher','brother',{active:false})];
 const result=await menu.publishRichMenu(db,null);same(result.linked,{brother:1,admin:1});same(bulk,[{richMenuId:ids[1],userIds:[uid('2')]},{richMenuId:ids[2],userIds:[uid('3')]}]);assert.equal(images.size,3);assert.equal((await menu.richMenuStatus(db)).installed,true);
 await menu.publishRichMenu(db,menuId);assert.equal(createCount,3);assert.equal(publishCount,1);
 await assert.rejects(menu.publishRichMenu(db,null),/已變更/);assert.equal(createCount,3);
 // Per-member switching after role, gender, pairing or deletion changes.
 members[0].gender='brother';members[2].role='publisher';await menu.syncMemberRichMenus(db,[uid('1'),uid('3'),uid('9'),null,uid('1')]);
 same(userLinks,{[uid('1')]:ids[1]});members[0].role='admin';await menu.syncMemberRichMenus(db,[uid('1')]);assert.equal(userLinks[uid('1')],ids[2]);
 members[0].deletedAt=new Date();await menu.syncMemberRichMenus(db,[uid('1')]);assert.equal(userLinks[uid('1')],undefined);
 reset();members=[member('2','publisher','brother')];await menu.syncMemberRichMenus(db,[uid('2')]);same(userLinks,{},'no switching before menus are published');
 reset();current=otherId;uploadFails=true;await assert.rejects(menu.publishRichMenu(db,otherId));assert.equal(current,otherId);assert.equal(publishCount,0);assert.equal(createCount,1);
 uploadFails=false;await menu.publishRichMenu(db,otherId);assert.equal(current,menuId);assert.equal(createCount,3,'reuse menu after failed upload');
 reset();setTimeoutOnce=true;await assert.rejects(menu.publishRichMenu(db,null));assert.equal(current,menuId);await menu.publishRichMenu(db,menuId);assert.equal(createCount,3);assert.equal(publishCount,1);
 reset();rows.push({key:'line_rich_menu_publish_lock',value:`${Date.now()+120000}:other`});await assert.rejects(menu.publishRichMenu(db,null),/正在發布/);assert.equal(createCount,0);
 env.LINE_BOT_ENABLED='false';assert.equal((await menu.richMenuStatus(db)).enabled,false);await assert.rejects(menu.publishRichMenu(db,null),/設定/);env.LINE_BOT_ENABLED='true';
 let actor='publisher';const route=load('src/app/api/line-bot/rich-menu/route.ts',{'../../../../lib/db':{prisma:db},'../../../../lib/line-rich-menu':menu,'../../../../lib/api-auth':{requireApiUser:async roles=>{assert.equal(roles[0],'admin');return actor==='admin'?{user:{id:'admin'}}:{response:new Response(null,{status:403})}}}});
 assert.equal((await route.GET()).status,403);assert.equal((await route.POST({})).status,403);actor='admin';assert.equal((await route.POST({json:async()=>({})})).status,400);
 actor='publisher';env.CRON_SECRET='operator';assert.equal((await route.GET({headers:new Headers({authorization:'Bearer wrong'})})).status,403);assert.equal((await route.GET({headers:new Headers({authorization:'Bearer operator'})})).status,200);assert.equal((await route.POST({headers:new Headers({authorization:'Bearer operator'}),json:async()=>({})})).status,400);delete env.CRON_SECRET;
 console.log('PASS: sister/brother/admin menus and images, member menu kind, publish + bulk link, per-member switching, admin authorization, publish order, repeat install, stale default protection, failed upload preservation/retry, ambiguous publish, concurrent lock, disabled bot.');
})().catch(e=>{console.error(e);process.exitCode=1});
