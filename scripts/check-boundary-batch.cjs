const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('../public/tools/boundary-editor/geometry.js');
const base=G.refresh({schemaVersion:1,mapId:'nanzih',sourceSha256:'test',sourceImage:'test.png',imageSize:[100,100],coordinateSystem:{type:'image-pixel',order:'xy',origin:'top-left',yDirection:'down'},labelAnchors:[],summary:{},candidates:[{candidateId:'one',polygons:[[[[20,20],[30,21],[40,19],[50,21],[60,20],[80,20],[80,80],[20,80],[20,20]]]]},{candidateId:'two',polygons:[[[[1,1],[5,1],[5,5],[1,5],[1,1]]]]}]});
function node(){return {children:[],events:{},dataset:{},value:'',checked:true,clientWidth:100,clientHeight:100,textContent:'',hidden:false,
 setAttribute(k,v){this[k]=v;if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;},append(...c){this.children.push(...c)},replaceChildren(...c){this.children=c},addEventListener(k,fn){this.events[k]=fn},classList:{contains:()=>false},
 setPointerCapture(){},hasPointerCapture(){return true},releasePointerCapture(){},createSVGPoint(){return {x:0,y:0,matrixTransform(){return this}}},getScreenCTM(){return {inverse(){return {}}}}};}
(async()=>{
 const html=fs.readFileSync('public/tools/boundary-editor/index.html','utf8'),ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 const elements=new Map(),get=id=>{assert(ids.has(id),'HTML 缺少 '+id);if(!elements.has(id))elements.set(id,node());return elements.get(id)};
 get('map').value='nanzih';get('smoothStrength').value='3';
 const modes=['select','vertex','cut','box'].map(mode=>{const n=node();n.dataset.mode=mode;return n});
 let draft=null,version=0;const keyboard={};
 vm.runInNewContext(fs.readFileSync('public/tools/boundary-editor/editor.js','utf8'),{window:{BoundaryGeometry:G,addEventListener(){}},document:{getElementById:get,querySelectorAll:()=>modes,createElementNS:node,addEventListener:(k,v)=>keyboard[k]=v},location:{port:'',search:''},URLSearchParams,ResizeObserver:class{observe(){}},localStorage:{getItem:()=>null,setItem(){}},confirm:()=>true,
 fetch:async(url,options)=>{if(url.includes('reconstruction-v1'))return {ok:true,json:async()=>G.clone(base)};if(options?.method==='PUT'){draft=JSON.parse(options.body).document;version++}return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>options?.method==='PUT'?{saved:{version}}:{draft:draft&&{document:draft,version}}}}});
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 const svg=get('mapCanvas'),event=(x,y,target=node(),extra={})=>({button:0,clientX:x,clientY:y,target,pointerId:1,...extra});
 const region=get('regions').children[0];svg.events.pointerdown(event(40,40,region));svg.events.pointerup(event(40,40,region));modes.find(n=>n.dataset.mode==='box').onclick();
 const box=(a,b,shiftKey=false)=>{svg.events.pointerdown(event(...a,node(),{shiftKey}));svg.events.pointermove(event(...b));svg.events.pointerup(event(...b));};
 box([0,0],[51,22]);assert.equal(get('vertexCount').textContent,'已選 4 點','框選不包含鄰近候選的頂點');
 box([59,19],[61,22],true);assert.equal(get('vertexCount').textContent,'已選 5 點');
 get('smoothVertices').onclick();assert.match(get('message').textContent,/已平滑/);assert.equal(get('save').disabled,false);await get('save').onclick();assert(draft.candidates[0].polygons[0][0].length<9);assert.deepEqual(draft.candidates[1].polygons,base.candidates[1].polygons);
 get('undo').onclick();assert.equal(get('save').disabled,false);get('redo').onclick();assert.equal(get('save').disabled,true);
 // Reload original via import to exercise batch delete and keyboard routing.
 await get('import').onchange({target:{files:[{size:100,text:async()=>JSON.stringify(base)}],value:''}});
 modes.find(n=>n.dataset.mode==='select').onclick();const first=get('regions').children[0];svg.events.pointerdown(event(40,40,first));svg.events.pointerup(event(40,40,first));modes.find(n=>n.dataset.mode==='box').onclick();
 box([29,18],[51,22]);assert.equal(get('vertexCount').textContent,'已選 3 點');
 keyboard.keydown({key:'Delete',target:{matches:()=>false},preventDefault(){}});assert.match(get('message').textContent,/減少 3 點/);await get('save').onclick();assert.equal(draft.candidates[0].polygons[0][0].length,6);
 box([0,0],[100,100]);get('deleteVertices').onclick();assert.match(get('message').textContent,/至少保留/);assert.equal(get('vertexCount').textContent,'已選 5 點');
 console.log('PASS: actual UI box selection, Shift append, smoothing, batch Delete, undo/redo, atomic rejection and saved readback.');
})().catch(e=>{console.error(e);process.exitCode=1});
