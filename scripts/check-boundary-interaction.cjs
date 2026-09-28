const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const G=require('../public/tools/boundary-editor/geometry.js');
const base=G.independentBlocks(require('../public/maps/reconstruction-v1/nanzih.json'));
async function editor(){
 const nodes=new Map(),docEvents={},events={};
 function node(){const n={hidden:false,disabled:false,checked:true,value:'nanzih',clientWidth:1000,clientHeight:600,children:[],attrs:{},dataset:{},textContent:'',listeners:{},classList:{contains(c){return (n.attrs.class||'').split(' ').includes(c)},toggle(){return false}},setAttribute(k,v){n.attrs[k]=String(v);if(k.startsWith('data-'))n.dataset[k.slice(5)]=String(v)},getAttribute(k){return n.attrs[k]},replaceChildren(...c){n.children=c},append(...c){n.children.push(...c)},addEventListener(k,f){n.listeners[k]=f},setPointerCapture(){},hasPointerCapture(){return false},releasePointerCapture(){},getBoundingClientRect(){return{left:0,top:0,width:1000,height:600}},matches(){return false},querySelector(s){return n.children.find(c=>c.classList?.contains(s.slice(1)))},click(){if(!n.disabled)return n.onclick?.()}};return n}
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
 const modes=['select','draw','cut','vertex','box','pan'].map(mode=>{const n=node();n.dataset.mode=mode;return n});
 const svg=get('mapCanvas');svg.createSVGPoint=()=>({x:0,y:0,matrixTransform(){return{x:this.x,y:this.y}}});svg.getScreenCTM=()=>({inverse:()=>({})});
 const document={getElementById:get,querySelectorAll:s=>s==='[data-mode]'?modes:[],querySelector:()=>node(),createElementNS:()=>node(),addEventListener:(k,f)=>docEvents[k]=f};
 let saved=G.clone(base),writes=0,backup;
 vm.runInNewContext(fs.readFileSync('public/tools/boundary-editor/editor.js','utf8'),{window:{BoundaryGeometry:G,addEventListener:(k,f)=>events[k]=f,matchMedia:()=>({matches:false})},document,location:{search:'?access=public',port:''},URLSearchParams,crypto:{randomUUID:()=> 'test-nonce'},confirm:()=>true,localStorage:{getItem:()=>null,setItem:(k,v)=>backup=JSON.parse(v)},ResizeObserver:class{observe(){}},fetch:async(url,opts)=>{if(url.includes('reconstruction-v1'))return{ok:true,json:async()=>G.clone(base)};if(opts?.method==='PUT'){writes++;saved=JSON.parse(opts.body).document;return{ok:true,headers:{get:()=> 'application/json'},json:async()=>({saved:{version:2}})}}return{ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({draft:{document:G.clone(saved),version:writes?2:1}})}}});
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 const event=(type,x,y,id=1,pointerType='mouse',target=svg)=>svg.listeners[type]?.({button:0,clientX:x,clientY:y,pointerId:id,pointerType,target,preventDefault(){}});
 const click=(x,y)=>{event('pointerdown',x,y);event('pointerup',x,y)};
 return{get,modes,svg,event,click,key:key=>docEvents.keydown({key,target:node(),preventDefault(){}}),saved:()=>saved,writes:()=>writes,backup:()=>backup};
}
module.exports={editor,base};
if(require.main===module)(async()=>{
 const begin=ui=>ui.modes.find(n=>n.dataset.mode==='draw').click();
 const triangle=ui=>{ui.click(100,100);ui.click(300,100);ui.click(300,300)};
 const count=ui=>ui.get('regions').children.length;
 const ui=await editor();begin(ui);triangle(ui);
 assert.equal(ui.get('save').disabled,true,'preview must not be uploaded');
 assert.match(ui.get('saveState').textContent,/預覽/);
 ui.get('cancelDraw').click();assert.equal(count(ui),base.candidates.length);
 await ui.get('save').click();assert.equal(ui.writes(),0);
 begin(ui);triangle(ui);ui.key('Escape');assert.equal(count(ui),base.candidates.length);
 begin(ui);triangle(ui);ui.get('finishDraw').click();assert.equal(count(ui),base.candidates.length+1);
 assert.equal(ui.get('save').disabled,false);assert.match(ui.get('saveState').textContent,/尚未儲存/);
 begin(ui);triangle(ui);ui.get('cancelDraw').click();assert.equal(count(ui),base.candidates.length+1,'cancel preserves earlier completed work');
 ui.get('undo').click();assert.equal(count(ui),base.candidates.length);ui.get('redo').click();assert.equal(count(ui),base.candidates.length+1);
 await ui.get('save').click();assert.equal(ui.writes(),1);assert.match(ui.get('saveState').textContent,/已儲存到雲端/);
 // A bow tie must not silently commit the last valid triangle.
 begin(ui);ui.click(100,100);ui.click(300,300);ui.click(100,300);ui.click(300,100);
 assert.match(ui.get('message').textContent,/交叉/);assert.equal(ui.get('finishDraw').disabled,true);assert.equal(ui.get('save').disabled,true);
 ui.get('finishDraw').onclick();assert.equal(count(ui),base.candidates.length+1);
 ui.get('backPoint').click();assert.equal(ui.get('finishDraw').disabled,false);
 // Clicking the first blue point selects it; deletion removes that point only.
 const dot=ui.get('cutLine').children.find(n=>n.classList.contains('drawDot'));
 ui.event('pointerdown',100,100,1,'mouse',dot);ui.event('pointerup',100,100,1,'mouse',dot);
 assert.equal(ui.get('cutLine').children.filter(n=>n.classList.contains('drawDot')).length,3);
 ui.get('deleteDraftPoint').click();assert.equal(ui.get('finishDraw').disabled,true);
 assert.equal(ui.get('cutLine').children.filter(n=>n.classList.contains('drawDot'))[0].attrs.cx,'300');
 ui.get('cancelDraw').click();
 // Second finger cancels the pending tap; zoom never adds a vertex.
 begin(ui);const before=ui.svg.attrs.viewBox;
 ui.event('pointerdown',100,100,11,'touch');ui.event('pointerdown',300,100,12,'touch');ui.event('pointermove',400,100,12,'touch');
 assert.notEqual(ui.svg.attrs.viewBox,before);
 ui.event('pointerup',400,100,12,'touch');ui.event('pointermove',200,100,11,'touch');ui.event('pointerup',200,100,11,'touch');
 assert.equal(ui.get('backPoint').disabled,true);
 ui.event('pointerdown',100,100,13,'touch');ui.event('pointercancel',100,100,13,'touch');assert.equal(ui.get('backPoint').disabled,true);
 ui.event('pointerdown',100,100,14,'touch');ui.event('pointerup',100,100,14,'touch');assert.equal(ui.get('backPoint').disabled,false);
 ui.get('cancelDraw').click();
 // A second finger rolls back a vertex preview; first touch only selects.
 const touch=await editor();begin(touch);triangle(touch);touch.get('finishDraw').click();touch.modes.find(n=>n.dataset.mode==='vertex').click();
 const beforeDrag=JSON.stringify(touch.backup().document.candidates);
 let handle=touch.get('vertices').children[0];
 touch.event('pointerdown',100,100,31,'touch',handle);touch.event('pointermove',110,110,31,'touch',handle);touch.event('pointerup',110,110,31,'touch',handle);
 assert.equal(JSON.stringify(touch.backup().document.candidates),beforeDrag,'first touch cannot drag an unselected vertex');
 handle=touch.get('vertices').children[0];touch.event('pointerdown',100,100,32,'touch',handle);touch.event('pointerup',100,100,32,'touch',handle);
 handle=touch.get('vertices').children[0];touch.event('pointerdown',100,100,33,'touch',handle);touch.event('pointermove',110,110,33,'touch',handle);touch.event('pointerdown',300,300,34,'touch');touch.event('pointermove',350,350,34,'touch');touch.event('pointerup',350,350,34,'touch');touch.event('pointerup',110,110,33,'touch');
 assert.equal(JSON.stringify(touch.backup().document.candidates),beforeDrag,'pinch must discard vertex preview');
 // Manual numbers are edits even when polygon geometry is unchanged.
 const region=ui.get('regions').children[0];ui.event('pointerdown',100,100,1,'mouse',region);ui.event('pointerup',100,100,1,'mouse',region);
 ui.get('setNumber').value='58';ui.get('setNumber').listeners.input();ui.get('applyNumber').click();assert.equal(ui.get('save').disabled,false);
 console.log('PASS: cancel/Escape preserve prior work, preview cannot save, invalid boundary rejects, undo/redo, selected point deletion, multitouch/cancel without edits, manual-number dirty detection.');
})().catch(e=>{console.error(e);process.exitCode=1});
