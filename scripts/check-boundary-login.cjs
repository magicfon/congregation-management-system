// Run the actual editor initialization with controlled HTTP responses.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const G = require('../public/tools/boundary-editor/geometry.js')
const base = require('../public/maps/reconstruction-v1/nanzih.json')
const jsonb=x=>Array.isArray(x)?x.map(jsonb):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,jsonb(x[k])])):x
async function check(status, draft=null, backup=null, corruptAfterSave=false) {
  const elements = new Map()
  const node = () => ({hidden:false,checked:true,value:'nanzih',clientWidth:1000,clientHeight:600,
    setAttribute(){},replaceChildren(){},append(){},addEventListener(){},textContent:''})
  const document = {getElementById:id=>{if(!elements.has(id)) elements.set(id,node());return elements.get(id)},
    querySelectorAll:()=>[],createElementNS:node,addEventListener(){}}
  document.getElementById('login')
  vm.runInNewContext(fs.readFileSync('public/tools/boundary-editor/editor.js','utf8'),{
    window:{BoundaryGeometry:G,addEventListener(){}},document,
    location:{port:'',search:''},URLSearchParams,
    localStorage:{getItem:()=>backup&&JSON.stringify(backup),setItem:(_key,value)=>{backup=JSON.parse(value)}},ResizeObserver:class{observe(){}},
    fetch:async (url,options)=>{
      if(url.includes('/reconstruction-v1/'))return {ok:true,json:async()=>G.clone(base)}
      if(options?.method==='PUT'){
        const payload=JSON.parse(options.body)
        draft={document:jsonb(corruptAfterSave?base:payload.document),version:payload.expectedVersion+1,updatedAt:new Date().toISOString()}
        return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({saved:{version:draft.version}})}
      }
      return {ok:status===200,status,headers:{get:()=> 'application/json'},json:async()=>status===200?{draft}:{error:'test error'}}
    },
  })
  for(let i=0;i<5;i++)await new Promise(setImmediate)
  return elements
}
(async()=>{
  const admin=await check(200)
  assert.equal(admin.get('login').hidden,true,'管理員已通過雲端 API，但登入連結仍顯示')
  assert.match(admin.get('saveState').textContent,/雲端版本 0/)
  const anonymous=await check(401)
  assert.equal(anonymous.get('login').hidden,false)
  const denied=await check(403)
  assert.equal(denied.get('login').hidden,true,'已登入但無權限不應再要求登入')
  assert.equal(denied.get('save').disabled,true)
  const unavailable=await check(503)
  assert.equal(unavailable.get('login').hidden,true,'服務失敗不等於未登入')
  const loaded=await check(200,{document:jsonb(base),version:4,updatedAt:new Date().toISOString()})
  assert.match(loaded.get('saveState').textContent,/雲端版本 4/,'JSONB 重排欄位後仍須載入雲端版本')
  const fallback=await check(503,null,{document:base,dirty:false,baseVersion:4})
  assert.equal(fallback.get('restore').hidden,false,'已儲存的本機備份也必須可恢復')
  assert.match(fallback.get('message').textContent,/目前顯示原始候選/)
  for(const corrupt of [false,true]) {
    const editor=await check(200,null,null,corrupt)
    const modified=G.clone(base);modified.candidates[0].candidateId='nanzih-test-correction'
    await editor.get('import').onchange({target:{files:[{size:1000,text:async()=>JSON.stringify(modified)}],value:''}})
    assert.equal(editor.get('save').disabled,false)
    await editor.get('save').onclick()
    assert.match(editor.get('message').textContent,corrupt?/雲端讀回的邊界與送出內容不同/:/並確認可重新載入/)
    assert.equal(editor.get('save').disabled,!corrupt,'讀回不一致時不得清除未儲存狀態')
  }
  console.log('PASS: actual editor startup distinguishes admin, signed out, forbidden, and service failure.')
})().catch(e=>{console.error(e);process.exitCode=1})
