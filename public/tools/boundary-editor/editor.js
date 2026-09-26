/* Browser UI. Cloud writes only happen through the authenticated, versioned API. */
(function () {
  'use strict';
  const G=window.BoundaryGeometry, $=id=>document.getElementById(id), svg=$('mapCanvas'), ns='http://www.w3.org/2000/svg';
  let doc,base,selected=null,mode='select',cut=[],undo=[],redo=[],dirty=false,version=0,cloudReady=false,busy=false;
  let drawn=[];
  let view=[0,0,1,1],gesture=null,storageOK=true;
  let loadedGeometry='', savedGeometry='', vertex=null, pendingRecovery=null, needsReload=false;
  const geometryKey=d=>JSON.stringify(d.candidates.map(c=>[c.candidateId,c.polygons]).sort((a,b)=>a[0].localeCompare(b[0])));
  const editingBlocked=()=>busy||!doc||!cloudReady||!!pendingRecovery;
  function offerRecovery(){
    const saved=readBackup(doc.mapId);
    if(saved?.document){try{saved.document=G.independentBlocks(G.validate(saved.document,base));}catch{message('先前保留的修改無法讀取，請保留備份檔案以便檢查。');return;}}
    pendingRecovery=saved?.document&&(!cloudReady||(saved.dirty&&geometryKey(saved.document)!==geometryKey(doc)))?saved:null;
    if(pendingRecovery)message($('message').textContent+' 發現可恢復的修改；可按「恢復修改」查看。');
  }
  const selectedBlock=()=>doc?.candidates.find(c=>c.candidateId===selected);
  let selectedVertices=[];
  const vertexKey=v=>v.pi+':'+v.ri+':'+v.vi;
  const ids={nanzih:'楠梓',chiaotou:'橋頭',tzuguan:'梓官'};
  const key=id=>'boundary-editor-v1:'+id;
  const publicAccess=new URLSearchParams(location.search).get('access')==='public';
  const api=id=>(publicAccess?'/api/public/map-boundary-drafts/':'/api/map-boundary-drafts/')+id;
  if(publicAccess)$('accessNote').textContent='免登入編輯 · 儲存會更新所有人共用的地圖草稿。';
  const message=text=>$('message').textContent=text;
  const path=polys=>polys.map(p=>p.map(r=>'M'+r.map(p=>p.join(',')).join(' L')+' Z').join(' ')).join(' ');
  const element=(tag,attrs)=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
  function backup() {
    if(!doc)return true;
    try {localStorage.setItem(key(doc.mapId),JSON.stringify({document:doc,baseVersion:version,dirty,savedAt:new Date().toISOString()}));storageOK=true;return true;}
    catch {storageOK=false;message('瀏覽器無法保留本機備份，請立即匯出 JSON 或儲存。');return false;}
  }
  function readBackup(id) {try {return JSON.parse(localStorage.getItem(key(id))||'null');}catch{return null;}}
  function controls() {
    $('batchTools').hidden=mode!=='box';
    $('vertexCount').textContent=`已選 ${selectedVertices.length} 點`;
    for(const id of ['smoothVertices','deleteVertices','clearVertices'])$(id).disabled=editingBlocked()||!!gesture||!selectedVertices.length;
    $('smoothStrength').disabled=editingBlocked()||!!gesture;
    $('deleteBlock').disabled=editingBlocked()||!!gesture||!selected||cut.length>0;
    $('deleteVertex').disabled=editingBlocked()||!!gesture||mode!=='vertex'||!vertex||vertex.id!==selected;
    $('save').disabled=editingBlocked()||!dirty||cut.length>0;
    $('map').disabled=busy; $('loadCloud').disabled=busy||!doc; $('restore').disabled=busy; $('restore').hidden=!pendingRecovery; $('skipRestore').hidden=!pendingRecovery||!cloudReady; $('skipRestore').disabled=busy; $('loadCloud').hidden=!needsReload;
    $('export').disabled=busy||!doc; $('import').disabled=editingBlocked();
    $('undo').disabled=editingBlocked()||!undo.length; $('redo').disabled=editingBlocked()||!redo.length;
    $('finish').disabled=busy||cut.length<2; $('cancel').disabled=busy||!cut.length; $('focus').disabled=!selected||busy;
    $('finishDraw').disabled=busy||drawn.length<3; $('cancelDraw').disabled=busy||!drawn.length;
    const sel=selectedBlock();
    $('setNumber').disabled=editingBlocked()||!selected; $('applyNumber').disabled=editingBlocked()||!selected||!$('setNumber').value; $('clearNumber').disabled=editingBlocked()||!selected||sel?.manualNumber==null;
    if(selected&&sel&&document.activeElement!==$('setNumber'))$('setNumber').value=sel.manualNumber!=null?String(sel.manualNumber):'';
    document.querySelectorAll('[data-mode]').forEach(b=>{b.disabled=editingBlocked();b.setAttribute('aria-pressed',String(mode===b.dataset.mode));});
    $('saveState').textContent=busy?'處理中…':!doc?'未載入':!cloudReady?'無法載入，請重試':dirty?'尚未儲存':version?'已儲存':'尚無修改';
    $('hint').textContent=mode==='box'?'拖曳框選目前區塊的頂點；Shift 可追加選取。黃色為所選點，可平滑化或批次刪除；Esc 清除。':mode==='cut'?'逐點補線：由選取區塊邊界外開始，沿缺口畫到另一側邊界外，再按「完成補線」。Esc 取消。':mode==='draw'?'點擊地圖放置頂點，沿新區塊邊界逐一點出（至少 3 點），完成後按「完成新區塊」或 Enter。Esc 取消。':mode==='vertex'?'拖曳白色頂點調整邊界；點選頂點變黃後，可按「刪除頂點」或 Delete。每環至少保留 3 點，可復原。':'點選色塊；拖曳可平移，滾輪可縮放。Ctrl / ⌘ + Z 復原。';
  }
  function render() {
    if(!doc){controls();return;}
    const region=$('regions');region.replaceChildren();
    for(const c of [...doc.candidates].sort((a,b)=>b.pixelArea-a.pixelArea)) {
      const e=element('path',{d:path(c.polygons),fill:c.issues.length?'#f97316':'#22c55e','fill-opacity':$('overlay').checked?'.18':'0',stroke:c.candidateId===selected?'#38bdf8':($('overlay').checked?(c.issues.length?'#ea580c':'#16a34a'):'transparent'),'fill-rule':'evenodd',class:'region'+(c.candidateId===selected?' selected':''),'data-id':c.candidateId});
      const title=element('title',{});title.textContent='編號 '+(c.numberCandidates.join('、')||'未配對');e.append(title);
      region.append(e);
    }
    const labels=$('labels');labels.replaceChildren();
    if($('anchors').checked)for(const a of doc.labelAnchors)labels.append(element('circle',{cx:a.point[0],cy:a.point[1],r:view[2]/Math.max(svg.clientWidth,1)*2.5,fill:'#e11d48'}));
    drawHandles();drawCut();if(mode==='draw')drawDraft();controls();
    const c=selectedBlock();
    const issueNames={'image-edge':'碰圖片邊緣','multiple-numbers':'多個編號合併','no-number':'尚未配對編號'};
    $('selection').textContent=c?`選取：${c.numberCandidates.join('、')||'未配對編號'}${c.manualNumber!=null?'（手動指定）':''}｜${c.issues.map(i=>issueNames[i]||i).join('、')||'單一編號'}｜仍待核對｜可用「指定號碼」改號`:'尚未選取區塊';
    $('summary').textContent=`${doc.candidates.length} 塊候選 · ${doc.summary.singleNumberInteriorCandidates} 塊單一編號`;
  }
  function drawHandles() {
    const group=$('vertices');group.replaceChildren();if(!['vertex','box'].includes(mode))return;
    const c=doc.candidates.find(c=>c.candidateId===selected);if(!c)return;
    const r=view[2]/Math.max(svg.clientWidth,1)*(mode==='box'?3.5:5),chosen=new Set(selectedVertices.map(vertexKey));
    c.polygons.forEach((poly,pi)=>poly.forEach((ring,ri)=>ring.slice(0,-1).forEach(([x,y],vi)=>{
      if(x<view[0]-r||x>view[0]+view[2]+r||y<view[1]-r||y>view[1]+view[3]+r)return;
      group.append(element('circle',{cx:x,cy:y,r,class:'handle'+((mode==='box'?chosen.has(vertexKey({pi,ri,vi})):vertex?.id===selected&&vertex.pi===pi&&vertex.ri===ri&&vertex.vi===vi)?' active-vertex':''),'data-pi':pi,'data-ri':ri,'data-vi':vi}));
    })));
  }
  function drawCut() {
    $('cutLine').replaceChildren();if(!cut.length)return;
    $('cutLine').append(element('polyline',{points:cut.map(p=>p.join(',')).join(' '),class:'cut'}));
    for(const [x,y] of cut)$('cutLine').append(element('circle',{cx:x,cy:y,r:view[2]/Math.max(svg.clientWidth,1)*4,fill:'#e11d48','pointer-events':'none'}));
  }
  function drawDraft() {
    $('cutLine').replaceChildren();if(!drawn.length)return;
    if(drawn.length>1)$('cutLine').append(element('polyline',{points:drawn.map(p=>p.join(',')).join(' '),class:'cut'}));
    if(drawn.length>2)$('cutLine').append(element('polygon',{points:drawn.map(p=>p.join(',')).join(' '),fill:'#38bdf833',stroke:'#38bdf8','stroke-width':2,'vector-effect':'non-scaling-stroke','pointer-events':'none'}));
    for(const [x,y] of drawn)$('cutLine').append(element('circle',{cx:x,cy:y,r:view[2]/Math.max(svg.clientWidth,1)*4,fill:'#38bdf8','pointer-events':'none'}));
  }
  function setView(next) {view=next;svg.setAttribute('viewBox',view.join(' '));if(doc){drawHandles();drawCut();}}
  function fit() {if(!doc)return;const [w,h]=doc.imageSize;const ratio=svg.clientWidth/Math.max(svg.clientHeight,1);const vw=Math.max(w,h*ratio),vh=vw/ratio;setView([(w-vw)/2,(h-vh)/2,vw,vh]);}
  function zoom(factor,center=[view[0]+view[2]/2,view[1]+view[3]/2]) {if(!doc)return;const w=view[2]*factor;if(w<40||w>doc.imageSize[0]*5)return;setView([center[0]+(view[0]-center[0])*factor,center[1]+(view[1]-center[1])*factor,w,view[3]*factor]);}
  function point(event) {const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const v=p.matrixTransform(svg.getScreenCTM().inverse());return [v.x,v.y];}
  function commit(next) {undo.push(G.clone(doc));if(undo.length>20)undo.shift();redo=[];doc=next;dirty=geometryKey(doc)!==savedGeometry;cut=[];backup();render();}
  function applyDocument(next) {doc=G.independentBlocks(G.validate(next,base));selected=null;mode='select';vertex=null;selectedVertices=[];undo=[];redo=[];cut=[];render();}
  async function cloudRequest(id,options) {
    const response=await fetch(api(id),{cache:'no-store',...options});
    const contentType=response.headers.get('content-type')||'';
    const data=contentType.includes('application/json')?await response.json():{};
    // Authentication and service availability are separate: a failed request
    // must not automatically tell an already signed-in user to sign in again.
    const offline=!contentType.includes('application/json')&&response.status===404;
    $('login').hidden=response.status!==401&&!offline;
    if(response.status===401){$('login').textContent='登入管理員帳號';$('login').href='/login?callbackUrl=/map/boundary-editor';cloudReady=false;}
    if(response.status===403)cloudReady=false;
    if(offline){$('login').textContent='開啟雲端版';$('login').href='https://congregation-management-system.vercel.app/map/boundary-editor';}
    if(!response.ok){needsReload=true;throw new Error(data.error || (response.status===401?'請先登入管理員帳號。':response.status===403?'僅管理員可存取雲端草稿。':'暫時無法連線，請稍後重試。'));}
    return data;
  }
  async function openMap(id) {
    if(doc&&dirty&&!backup()){ $('map').value=doc.mapId;return; }
    busy=true;controls();message('');
    try {
      const response=await fetch(`/maps/reconstruction-v1/${id}.json`);if(!response.ok){needsReload=true;throw new Error('無法載入原始候選。');}
      base=await response.json();loadedGeometry=geometryKey(base);doc=G.independentBlocks(base);selected=null;mode='select';vertex=null;selectedVertices=[];undo=[];redo=[];cut=[];drawn=[];dirty=false;version=0;cloudReady=false;pendingRecovery=null;needsReload=false;
      $('background').setAttribute('href','/maps/'+base.sourceImage);$('background').setAttribute('width',base.imageSize[0]);$('background').setAttribute('height',base.imageSize[1]);
      try {const result=await cloudRequest(id);if(result.draft){loadedGeometry=geometryKey(result.draft.document);applyDocument(result.draft.document);version=result.draft.version;message('');}cloudReady=true;}
      catch(error){cloudReady=false;needsReload=true;message('載入失敗，目前顯示原始候選，尚未取得已儲存修改。'+error.message);}
      savedGeometry=loadedGeometry;dirty=cloudReady&&geometryKey(doc)!==loadedGeometry;if(dirty)message('已將內部小區塊轉為獨立區塊，請核對後儲存。');
      offerRecovery();
      fit();render();
    }catch(error){message(error.message);if(doc)$('map').value=doc.mapId;}
    finally {busy=false;controls();}
  }
  $('map').onchange=()=>openMap($('map').value);
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{
    if(editingBlocked())return;
    if(b.dataset.mode!=='select'&&b.dataset.mode!=='draw'&&!selected){message('請先點選一塊要修正的色塊。');return;}
    mode=b.dataset.mode;vertex=null;selectedVertices=[];cut=[];drawn=[];message('');render();
  });
  $('finish').onclick=()=>{try {const next=G.split(doc,selected,cut,crypto.randomUUID());commit(next);selected=null;mode='select';vertex=null;selectedVertices=[];mode='select';message('已切開區塊並重新配對編號，請核對後儲存。');render();}catch(error){message(error.message);}};
  $('cancel').onclick=()=>{cut=[];render();};
  $('finishDraw').onclick=()=>{try{const next=G.addBlock(doc,drawn,crypto.randomUUID().slice(0,8));commit(next);const log=next.correctionLog[next.correctionLog.length-1];drawn=[];mode='select';const last=doc.candidates[doc.candidates.length-1];selected=last?last.candidateId:null;message(`已建立新區塊${log.carved?`，${log.carved} 塊舊區塊已自動讓位`:''}${log.removed?`，${log.removed} 塊被完全覆蓋而移除`:''}；可指定號碼後儲存（可復原）。`);render();}catch(error){message(error.message);}};
  $('cancelDraw').onclick=()=>{drawn=[];mode='select';render();};
  $('applyNumber').onclick=()=>{if(!selected){message('請先點選區塊。');return;}const n=Number($('setNumber').value);try{commit(G.setNumber(doc,selected,n));message(`已指定號碼 ${n}，儲存後生效。`);}catch(error){message(error.message);}};
  $('clearNumber').onclick=()=>{if(!selected){message('請先點選區塊。');return;}try{commit(G.setNumber(doc,selected,null));message('已改回自動配對。');}catch(error){message(error.message);}};
  $('setNumber').addEventListener('input',()=>{const n=Number($('setNumber').value);$('applyNumber').disabled=editingBlocked()||!selected||!Number.isInteger(n)||n<1||n>999;});
  $('setNumber').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!$('applyNumber').disabled)$('applyNumber').click();}});
  function deleteVertex(){if(editingBlocked()||gesture||mode!=='vertex'||!vertex||vertex.id!==selected)return;try{const v=vertex;const next=G.removeVertex(doc,selected,v.pi,v.ri,v.vi);vertex=null;commit(next);message('頂點已刪除，前後頂點已連接；可復原，尚未儲存。');}catch(error){message(error.message);}}
  $('deleteVertex').onclick=deleteVertex;
  function batchEdit(operation){
    if(editingBlocked()||gesture||mode!=='box'||!selectedVertices.length)return;
    try{
      const count=d=>d.candidates.find(c=>c.candidateId===selected).polygons.reduce((n,p)=>n+p.reduce((m,r)=>m+r.length-1,0),0);
      const before=count(doc),result=G.batchVertexEdit(doc,selected,selectedVertices,operation,Number($('smoothStrength').value)),next=result.document;
      const removed=before-count(next);selectedVertices=result.selection;vertex=null;commit(next);
      message(`${operation==='smooth'?'已平滑邊界':'已刪除所選頂點'}，減少 ${removed} 點；可復原，尚未儲存。`);
    }catch(error){message(error.message);}
  }
  $('smoothVertices').onclick=()=>batchEdit('smooth');$('deleteVertices').onclick=()=>batchEdit('delete');
  $('clearVertices').onclick=()=>{selectedVertices=[];render();};
  function drawBox(a,b){$('boxSelection').replaceChildren(element('rect',{x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(a[0]-b[0]),height:Math.abs(a[1]-b[1]),class:'selection-box'}));}

  $('deleteBlock').onclick=()=>{
    if(editingBlocked()||gesture||!selected||cut.length)return;
    try{const next=G.removeCandidate(doc,selected);selected=null;mode='select';vertex=null;selectedVertices=[];mode='select';commit(next);message('區塊已刪除，可按「復原」恢復；尚未儲存。');}catch(error){message(error.message);}
  };
  function history(back) {if(editingBlocked())return;const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;to.push(G.clone(doc));doc=from.pop();dirty=geometryKey(doc)!==savedGeometry;selected=null;mode='select';vertex=null;selectedVertices=[];cut=[];backup();render();}
  $('undo').onclick=()=>history(true);$('redo').onclick=()=>history(false);
  $('overlay').onchange=render;$('anchors').onchange=render;
  $('plus').onclick=()=>zoom(.7);$('minus').onclick=()=>zoom(1/.7);$('fit').onclick=fit;
  $('plus2').onclick=()=>zoom(.7);$('minus2').onclick=()=>zoom(1/.7);$('fit2').onclick=fit;
  $('toolToggle').onclick=()=>{const h=document.querySelector('header'),open=h.classList.toggle('open');$('toolToggle').setAttribute('aria-expanded',String(open));$('toolToggle').textContent=open?'工具 ▲':'工具 ▼';};
  $('focus').onclick=()=>{const c=selectedBlock();if(!c)return;const pts=c.polygons.flat(2);const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;const ratio=svg.clientWidth/Math.max(svg.clientHeight,1),vw=Math.max(w,h*ratio)*1.15;setView([x+w/2-vw/2,y+h/2-vw/ratio/2,vw,vw/ratio]);};
  svg.addEventListener('wheel',e=>{e.preventDefault();if(!busy)zoom(e.deltaY>0?1.15:1/1.15,point(e));},{passive:false});
  svg.addEventListener('pointerdown',e=>{
    if(editingBlocked()||e.button!==0)return;
    const p=point(e),target=e.target;
    if(mode==='box'){if(!selected){message('請先選取區塊。');return;}gesture={kind:'box',start:p,append:e.shiftKey};drawBox(p,p);svg.setPointerCapture(e.pointerId);controls();return;}
    if(mode==='cut') {if(p[0]<0||p[1]<0||p[0]>=doc.imageSize[0]||p[1]>=doc.imageSize[1])return;cut.push(p);drawCut();controls();return;}
    if(mode==='draw') {if(p[0]<0||p[1]<0||p[0]>=doc.imageSize[0]||p[1]>=doc.imageSize[1])return;drawn.push(p);drawDraft();controls();return;}
    if(target.classList.contains('handle')) {
      const pi=Number(target.dataset.pi),ri=Number(target.dataset.ri),vi=Number(target.dataset.vi),c=doc.candidates.find(c=>c.candidateId===selected);
      vertex={id:selected,pi,ri,vi};
      gesture={kind:'vertex',pi,ri,vi,preview:G.clone(c.polygons),node:target,start:p};
    }else gesture={kind:'pan',start:[e.clientX,e.clientY],view:view.slice(),id:target.dataset.id,moved:false};
    svg.setPointerCapture(e.pointerId);controls();
  });
  svg.addEventListener('pointermove',e=>{
    if(!gesture)return;
    if(gesture.kind==='box'){drawBox(gesture.start,point(e));return;}
    if(gesture.kind==='pan') {const dx=e.clientX-gesture.start[0],dy=e.clientY-gesture.start[1];gesture.moved ||= Math.hypot(dx,dy)>4;const scale=gesture.view[2]/svg.clientWidth;setView([gesture.view[0]-dx*scale,gesture.view[1]-dy*scale,gesture.view[2],gesture.view[3]]);}
    else {const p=point(e),r=gesture.preview[gesture.pi][gesture.ri];r[gesture.vi]=p;if(gesture.vi===0)r[r.length-1]=p;gesture.node.setAttribute('cx',p[0]);gesture.node.setAttribute('cy',p[1]);$('regions').querySelector('.selected').setAttribute('d',path(gesture.preview));}
  });
  svg.addEventListener('pointerup',e=>{
    if(!gesture)return;const g=gesture;gesture=null;
    if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
    if(g.kind==='box'){
      $('boxSelection').replaceChildren();const end=point(e),found=g.append?selectedVertices.slice():[],seen=new Set(found.map(vertexKey));
      const c=doc.candidates.find(c=>c.candidateId===selected);
      c.polygons.forEach((poly,pi)=>poly.forEach((ring,ri)=>ring.slice(0,-1).forEach(([x,y],vi)=>{
        if(x>=Math.min(g.start[0],end[0])&&x<=Math.max(g.start[0],end[0])&&y>=Math.min(g.start[1],end[1])&&y<=Math.max(g.start[1],end[1])){
          const v={pi,ri,vi};if(!seen.has(vertexKey(v))){found.push(v);seen.add(vertexKey(v));}
        }
      })));
      selectedVertices=found;message(found.length?'已框選頂點，可平滑化或刪除。':'框內沒有目前區塊的頂點。');render();return;
    }
    if(g.kind==='pan'){if(!g.moved&&g.id){selected=g.id;vertex=null;selectedVertices=[];cut=[];message('');render();}}
    else {const p=point(e);if(Math.hypot(p[0]-g.start[0],p[1]-g.start[1])<.01){render();return;}try{commit(G.move(doc,selected,g.pi,g.ri,g.vi,p));message('頂點已調整，尚未儲存。');}catch(error){message(error.message);render();}}
  });
  svg.addEventListener('pointercancel',()=>{gesture=null;$('boxSelection').replaceChildren();render();});
  document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||e.target.isContentEditable||busy||gesture)return;if(e.key==='Delete'&&mode==='box'){e.preventDefault();batchEdit('delete');}if(e.key==='Delete'&&mode==='vertex'&&vertex){e.preventDefault();deleteVertex();}if(e.key==='Escape'){selectedVertices=[];$('boxSelection').replaceChildren();cut=[];drawn=[];gesture=null;render();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(!e.shiftKey);}if(e.key==='Enter'&&mode==='cut'&&cut.length>=2)$('finish').click();if(e.key==='Enter'&&mode==='draw'&&drawn.length>=3)$('finishDraw').click();});
  $('save').onclick=async()=>{
    busy=true;controls();message('');const snapshot=G.clone(doc);
    try {
      const result=await cloudRequest(doc.mapId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:version,document:snapshot})});
      version=result.saved.version;
      const check=await cloudRequest(doc.mapId);
      if(!check.draft || check.draft.version!==version)throw new Error('儲存後讀回版本不一致，請先匯出本機備份，再載入雲端核對。');
      G.validate(check.draft.document,base);
      const signature=geometryKey;
      if(signature(check.draft.document)!==signature(snapshot))throw new Error('儲存後讀回的邊界與送出內容不同，已保留本機修正，請勿以原圖覆蓋。');
      dirty=false;needsReload=false;pendingRecovery=null;savedGeometry=geometryKey(doc);backup();message('已儲存，並確認可重新載入。');
    }
    catch(error){needsReload=true;backup();message('儲存未完成，修改已暫時保留。'+error.message);}
    finally{busy=false;controls();}
  };
  $('loadCloud').onclick=async()=>{
    if((dirty||cut.length)&&!confirm('重新載入會取代目前畫面，尚未儲存的修改會暫時保留供恢復。繼續？'))return;
    if(dirty&&!backup())return;busy=true;controls();
    try {const result=await cloudRequest(doc.mapId);applyDocument(result.draft?.document||base);version=result.draft?.version||0;dirty=geometryKey(doc)!==geometryKey(result.draft?.document||base);savedGeometry=geometryKey(result.draft?.document||base);cloudReady=true;needsReload=false;message('已載入儲存內容。');offerRecovery();}
    catch(error){message(error.message);}finally{busy=false;controls();}
  };
  $('restore').onclick=()=>{
    const saved=pendingRecovery;if(!saved)return;
    if(dirty&&!confirm('以先前保留的修改取代目前畫面？'))return;
    try {applyDocument(saved.document);version=saved.baseVersion;dirty=geometryKey(doc)!==savedGeometry;pendingRecovery=null;backup();message(cloudReady?'已恢復修改，確認後請按「儲存」。':'已恢復修改供查看及匯出；連線恢復後請重新載入，再恢復修改並儲存。');controls();}catch(error){message(error.message);}
  };
  $('skipRestore').onclick=()=>{if(!cloudReady||!pendingRecovery||!confirm('放棄先前未儲存的修改，保留目前已儲存內容？'))return;pendingRecovery=null;backup();message('已保留儲存內容。');controls();};
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify({...doc,editorBackup:{baseVersion:version}},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${doc.mapId}-corrections-v${version}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message(cut.length?'已匯出已完成修正；正在繪製的補線尚未包含。':'已匯出修正 JSON。');};
  $('import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>2_000_000){message('檔案超過 2 MB。');return;}if(dirty&&!confirm('匯入將取代目前修正，請先確認已備份。'))return;
    busy=true;controls();try{const next=JSON.parse(await file.text());G.validate(next,base);if(next.editorBackup && (!Number.isSafeInteger(next.editorBackup.baseVersion)||next.editorBackup.baseVersion<0))throw new Error('備份版本無效。');const previousVersion=version;commit(G.independentBlocks(next));version=next.editorBackup?.baseVersion??previousVersion;backup();message('已匯入修正，請核對後儲存。');}catch(error){message(error.message);}finally{busy=false;controls();}};
  window.addEventListener('beforeunload',e=>{if(dirty||cut.length){e.preventDefault();e.returnValue='';}});
  new ResizeObserver(()=>{if(doc)drawHandles();}).observe(svg);
  if(location.port==='18832')$('login').href='https://congregation-management-system.vercel.app/map/boundary-editor';
  const requested=new URLSearchParams(location.search).get('map');if(requested&&ids[requested])$('map').value=requested;
  openMap($('map').value);
})();
