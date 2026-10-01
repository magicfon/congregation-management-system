// No external calls: runs real publish/notification flows with mocked LINE and DB.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),sharp=require('sharp');
const env={LINE_BOT_ENABLED:'true',LINE_BOT_SAME_PROVIDER:'true',LINE_BOT_CHANNEL_SECRET:'secret',LINE_BOT_ACCESS_TOKEN:'token'};
let current=null,remoteMenu=null,hasImage=false,uploadFails=false,setTimeoutOnce=false,createCount=0,publishCount=0,rows=[];
const menuId='richmenu-'+'a'.repeat(32),otherId='richmenu-'+'b'.repeat(32);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function transport(url,options){
 const method=options.method||'GET';assert.equal(options.headers.Authorization,'Bearer token');
 if(url.endsWith('/user/all/richmenu'))return current?json({richMenuId:current}):json({},404);
 if(url.endsWith('/richmenu')&&method==='POST'){createCount++;remoteMenu=menuId;return json({richMenuId:menuId})}
 if(url.endsWith(`/user/all/richmenu/${menuId}`)){publishCount++;current=menuId;if(setTimeoutOnce){setTimeoutOnce=false;throw Error('response lost')}return json({})}
 if(url.endsWith(`/richmenu/${menuId}/content`)){
  if(method==='GET')return hasImage?new Response('image'):json({},404);
  assert.equal(options.headers['Content-Type'],'image/png');assert(options.body.length>100);if(uploadFails)return json({},500);hasImage=true;return json({});
 }
 if(url.endsWith(`/richmenu/${menuId}`))return remoteMenu?json({richMenuId:menuId}):json({},404);
 throw Error('Unexpected request '+url);
}
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,process:{env,cwd:()=>process.cwd()},Date,Buffer,Uint8Array,AbortSignal,fetch:transport,require:n=>mocks[n]??require(n)});return exports}
const client=load('src/lib/line-bot-client.ts');
const menu=load('src/lib/line-rich-menu.ts',{'./line-bot-client':client});
const matches=(r,w)=>Object.entries(w).every(([k,v])=>r[k]===v);
const db={setting:{
 findUnique:async({where})=>rows.find(r=>matches(r,where))||null,
 create:async({data})=>{if(rows.some(r=>r.key===data.key))throw Error('duplicate');rows.push({...data})},
 updateMany:async({where,data})=>{const r=rows.find(r=>matches(r,where));if(r)Object.assign(r,data);return{count:r?1:0}},
 upsert:async({where,create,update})=>{const r=rows.find(r=>matches(r,where));if(r)Object.assign(r,update);else rows.push({...create})},
 deleteMany:async({where})=>{rows=rows.filter(r=>!matches(r,where))},
}};
function reset(){current=null;remoteMenu=null;hasImage=false;uploadFails=false;setTimeoutOnce=false;createCount=0;publishCount=0;rows=[]}
(async()=>{
 const metadata=await sharp('public/line/rich-menu-v1.png').metadata();assert.equal(metadata.width,1000);assert.equal(metadata.height,674);assert(fs.statSync('public/line/rich-menu-v1.png').size<1000000);
 assert.equal(menu.menuDefinition.areas.length,4);assert.equal(menu.menuDefinition.areas[3].action.uri,client.botSite+'/bulletin');
 const commands=menu.menuDefinition.areas.slice(0,3).map(a=>a.action.text);assert.equal(commands.join(','),'我的地圖,本週行程,待交接');
 reset();assert.equal((await menu.richMenuStatus(db)).installed,false);await menu.publishRichMenu(db,null);assert.equal(current,menuId);assert.equal(createCount,1);assert(hasImage);assert.equal((await menu.richMenuStatus(db)).installed,true);
 await menu.publishRichMenu(db,menuId);assert.equal(createCount,1);assert.equal(publishCount,1);
 await assert.rejects(menu.publishRichMenu(db,null),/已變更/);assert.equal(createCount,1);
 reset();current=otherId;uploadFails=true;await assert.rejects(menu.publishRichMenu(db,otherId));assert.equal(current,otherId);assert.equal(publishCount,0);assert.equal(createCount,1);
 uploadFails=false;await menu.publishRichMenu(db,otherId);assert.equal(current,menuId);assert.equal(createCount,1,'reuse menu after failed upload');
 reset();setTimeoutOnce=true;await assert.rejects(menu.publishRichMenu(db,null));assert.equal(current,menuId);await menu.publishRichMenu(db,menuId);assert.equal(createCount,1);assert.equal(publishCount,1);
 reset();rows.push({key:'line_rich_menu_publish_lock',value:`${Date.now()+120000}:other`});await assert.rejects(menu.publishRichMenu(db,null),/正在發布/);assert.equal(createCount,0);
 env.LINE_BOT_ENABLED='false';assert.equal((await menu.richMenuStatus(db)).enabled,false);await assert.rejects(menu.publishRichMenu(db,null),/設定/);env.LINE_BOT_ENABLED='true';
 let actor='publisher';const route=load('src/app/api/line-bot/rich-menu/route.ts',{'../../../../lib/db':{prisma:db},'../../../../lib/line-rich-menu':menu,'../../../../lib/api-auth':{requireApiUser:async roles=>{assert.equal(roles[0],'admin');return actor==='admin'?{user:{id:'admin'}}:{response:new Response(null,{status:403})}}}});
 assert.equal((await route.GET()).status,403);assert.equal((await route.POST({})).status,403);actor='admin';assert.equal((await route.POST({json:async()=>({})})).status,400);
 console.log('PASS: four menu actions/image bounds, admin authorization, publish order, repeat install, stale default protection, failed upload preservation/retry, ambiguous publish, concurrent lock, disabled bot.');
})().catch(e=>{console.error(e);process.exitCode=1});
