// Run the actual editor initialization with controlled HTTP responses.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const G = require('../public/tools/boundary-editor/geometry.js')
const base = require('../public/maps/reconstruction-v1/nanzih.json')
async function check(status) {
  const elements = new Map()
  const node = () => ({hidden:false,checked:true,value:'nanzih',clientWidth:1000,clientHeight:600,
    setAttribute(){},replaceChildren(){},append(){},addEventListener(){},textContent:''})
  const document = {getElementById:id=>{if(!elements.has(id)) elements.set(id,node());return elements.get(id)},
    querySelectorAll:()=>[],createElementNS:node,addEventListener(){}}
  document.getElementById('login')
  vm.runInNewContext(fs.readFileSync('public/tools/boundary-editor/editor.js','utf8'),{
    window:{BoundaryGeometry:G,addEventListener(){}},document,
    location:{port:'',search:''},URLSearchParams,
    localStorage:{getItem:()=>null},ResizeObserver:class{observe(){}},
    fetch:async url=>url.includes('/reconstruction-v1/')?{ok:true,json:async()=>G.clone(base)}:
      {ok:status===200,status,headers:{get:()=> 'application/json'},json:async()=>status===200?{draft:null}:{error:'test error'}},
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
  console.log('PASS: actual editor startup distinguishes admin, signed out, forbidden, and service failure.')
})().catch(e=>{console.error(e);process.exitCode=1})
