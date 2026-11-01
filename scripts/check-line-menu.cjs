// No external calls: runs real publish/notification flows with mocked LINE and DB.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),sharp=require('sharp');
const env={LINE_BOT_ENABLED:'true',LINE_BOT_SAME_PROVIDER:'true',LINE_BOT_CHANNEL_SECRET:'secret',LINE_BOT_ACCESS_TOKEN:'token'};
let current=null,remote=new Set(),images=new Set(),uploadFails=false,setTimeoutOnce=false,createCount=0,publishCount=0,rows=[],members=[],bulk=[],userLinks={},aliases={};
const ids=['a','c','d','e','f'].map(c=>'richmenu-'+c.repeat(32)),menuId=ids[0],otherId='richmenu-'+'b'.repeat(32);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function transport(url,options){
 const method=options.method||'GET';assert.equal(options.headers.Authorization,'Bearer token');
 if(url.endsWith('/user/all/richmenu'))return current?json({richMenuId:current}):json({},404);
 if(url.endsWith('/richmenu')&&method==='POST'){const id=ids[createCount++];remote.add(id);return json({richMenuId:id})}
 const alias=url.match(/\/richmenu\/alias(?:\/([\w-]+))?$/);
 if(alias){
  if(method==='GET')return aliases[alias[1]]?json({richMenuAliasId:alias[1],richMenuId:aliases[alias[1]]}):json({},404);
  const body=JSON.parse(options.body),key=alias[1]||body.richMenuAliasId;assert(/^[a-z0-9_-]{1,32}$/.test(key));if(!alias[1]&&aliases[key])return json({},400);aliases[key]=body.richMenuId;return json({});
 }
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
function reset(){current=null;remote=new Set();images=new Set();uploadFails=false;setTimeoutOnce=false;createCount=0;publishCount=0;rows=[];members=[];bulk=[];userLinks={};aliases={}}
const uid=c=>'U'+c.repeat(32);
const member=(c,role,gender,extra={})=>({lineuid:uid(c),role,gender,active:true,deletedAt:null,...extra});
(async()=>{
 const counts={sister:4,'brother-general':6,'brother-manage':6,'admin-general':6,'admin-manage':10};
 for(const [key,count] of Object.entries(counts)){
  const def=menu.menuDefinitions[key],meta=await sharp(`public/line/rich-menu-${key}.png`).metadata();
  assert.equal(meta.width,def.size.width);assert.equal(meta.height,def.size.height);assert(fs.statSync(`public/line/rich-menu-${key}.png`).size<1000000);
  assert.equal(def.areas.length,count,key);assert(def.size.width/def.size.height>=1.45);assert(def.size.width<=2500&&def.size.width>=800);
  const area=def.areas.reduce((s,a)=>s+a.bounds.width*a.bounds.height,0);assert.equal(area,def.size.width*def.size.height,`${key} areas cover the image exactly`);
  assert(def.areas.every(a=>a.bounds.x+a.bounds.width<=def.size.width&&a.bounds.y+a.bounds.height<=def.size.height));
 }
 assert.equal(menu.menuDefinitions.sister.areas[2].action.text,'我的委派');
 const tabs=key=>menu.menuDefinitions[key].areas.filter(a=>a.action.type==='richmenuswitch').map(a=>a.action.richMenuAliasId);
 same(tabs('sister'),[]);for(const role of ['brother','admin'])for(const tab of ['general','manage'])same(tabs(`${role}-${tab}`),[menu.aliasId(`${role}-general`),menu.aliasId(`${role}-manage`)]);
 assert(menu.menuDefinitions['brother-manage'].areas.every(a=>a.action.type!=='richmenuswitch'||a.action.data));
 const uris=key=>menu.menuDefinitions[key].areas.filter(a=>a.action.type==='uri').map(a=>a.action.uri.slice(client.botSite.length));
 for(const key of ['sister','brother-general','admin-general'])same(uris(key),['/bulletin','/dashboard','/area-status']);
 same(uris('brother-manage'),['/bulletin/territory-report','/dashboard?view=handoffs','/schedules','/map-requests']);
 same(uris('admin-manage'),['/bulletin/territory-report','/dashboard?view=handoffs','/area-status','/map-requests','/service-roster/manage','/midweek/manage','/bulletin/announcements#manage-announcements','/members']);
 const liffMenu=load('src/lib/line-rich-menu.ts',{'./line-bot-client':client,'./liff-settings':{...settings,configuredLiffId:()=> '123-test'}});assert(Object.values(liffMenu.menuDefinitions).every(d=>d.areas.filter(a=>a.action.type==='uri').every(a=>new URL(a.action.uri).origin==='https://liff.line.me')));
 assert.equal(menu.memberMenuKind(member('1','admin','sister')),'admin');assert.equal(menu.memberMenuKind(member('1','publisher','brother')),'brother');assert.equal(menu.memberMenuKind(member('1','elder','brother')),'brother');
 assert.equal(menu.memberMenuKind(member('1','publisher','unspecified')),'sister');assert.equal(menu.memberMenuKind(member('1','admin','brother',{active:false})),'sister');assert.equal(menu.memberMenuKind(member('1','admin','brother',{deletedAt:new Date()})),'sister');assert.equal(menu.memberMenuKind(null),'sister');

 reset();current=otherId;rows.push({key:'line_rich_menu_v4',value:otherId});assert.equal((await menu.richMenuStatus(db)).installed,false);await menu.publishRichMenu(db,otherId);assert.equal(createCount,5);assert.equal(current,ids[0]);assert(rows.some(row=>row.key==='line_rich_menu_v6_admin-manage'&&row.value===ids[4]));
 same(aliases,{[menu.aliasId('brother-general')]:ids[1],[menu.aliasId('brother-manage')]:ids[2],[menu.aliasId('admin-general')]:ids[3],[menu.aliasId('admin-manage')]:ids[4]});
 reset();members=[member('1','publisher','sister'),member('2','publisher','brother'),member('3','admin','sister'),member('4','publisher','brother',{active:false})];
 const result=await menu.publishRichMenu(db,null);same(result.linked,{brother:1,admin:1});same(bulk,[{richMenuId:ids[1],userIds:[uid('2')]},{richMenuId:ids[3],userIds:[uid('3')]}]);assert.equal(images.size,5);assert.equal((await menu.richMenuStatus(db)).installed,true);
 await menu.publishRichMenu(db,menuId);assert.equal(createCount,5);assert.equal(publishCount,1);
 await assert.rejects(menu.publishRichMenu(db,null),/已變更/);assert.equal(createCount,5);
 // An alias pointing at an outdated menu is moved to the current one.
 reset();aliases[menu.aliasId('admin-manage')]=otherId;await menu.publishRichMenu(db,null);assert.equal(aliases[menu.aliasId('admin-manage')],ids[4]);
 reset();members=[member('1','publisher','sister'),member('2','publisher','brother'),member('3','admin','sister')];await menu.publishRichMenu(db,null);
 // Per-member switching after role, gender, pairing or deletion changes.
 members[0].gender='brother';members[2].role='publisher';await menu.syncMemberRichMenus(db,[uid('1'),uid('3'),uid('9'),null,uid('1')]);
 same(userLinks,{[uid('1')]:ids[1]});members[0].role='admin';await menu.syncMemberRichMenus(db,[uid('1')]);assert.equal(userLinks[uid('1')],ids[3]);
 members[0].deletedAt=new Date();await menu.syncMemberRichMenus(db,[uid('1')]);assert.equal(userLinks[uid('1')],undefined);
 reset();members=[member('2','publisher','brother')];await menu.syncMemberRichMenus(db,[uid('2')]);same(userLinks,{},'no switching before menus are published');
 reset();current=otherId;uploadFails=true;await assert.rejects(menu.publishRichMenu(db,otherId));assert.equal(current,otherId);assert.equal(publishCount,0);assert.equal(createCount,1);
 uploadFails=false;await menu.publishRichMenu(db,otherId);assert.equal(current,menuId);assert.equal(createCount,5,'reuse menu after failed upload');
 reset();setTimeoutOnce=true;await assert.rejects(menu.publishRichMenu(db,null));assert.equal(current,menuId);await menu.publishRichMenu(db,menuId);assert.equal(createCount,5);assert.equal(publishCount,1);
 reset();rows.push({key:'line_rich_menu_publish_lock',value:`${Date.now()+120000}:other`});await assert.rejects(menu.publishRichMenu(db,null),/正在發布/);assert.equal(createCount,0);
 env.LINE_BOT_ENABLED='false';assert.equal((await menu.richMenuStatus(db)).enabled,false);await assert.rejects(menu.publishRichMenu(db,null),/設定/);env.LINE_BOT_ENABLED='true';
 let actor='publisher';const route=load('src/app/api/line-bot/rich-menu/route.ts',{'../../../../lib/db':{prisma:db},'../../../../lib/line-rich-menu':menu,'../../../../lib/api-auth':{requireApiUser:async roles=>{assert.equal(roles[0],'admin');return actor==='admin'?{user:{id:'admin'}}:{response:new Response(null,{status:403})}}}});
 assert.equal((await route.GET()).status,403);assert.equal((await route.POST({})).status,403);actor='admin';assert.equal((await route.POST({json:async()=>({})})).status,400);
 actor='publisher';env.CRON_SECRET='operator';assert.equal((await route.GET({headers:new Headers({authorization:'Bearer wrong'})})).status,403);assert.equal((await route.GET({headers:new Headers({authorization:'Bearer operator'})})).status,200);assert.equal((await route.POST({headers:new Headers({authorization:'Bearer operator'}),json:async()=>({})})).status,400);delete env.CRON_SECRET;
 console.log('PASS: tabbed menus (sizes, area coverage, tab aliases, pages), aliases, member menu kind, publish + bulk link, per-member switching, admin authorization, publish order, repeat install, stale default protection, failed upload preservation/retry, ambiguous publish, concurrent lock, disabled bot.');
})().catch(e=>{console.error(e);process.exitCode=1});
