/* Browser UI. Cloud writes only happen through the authenticated, versioned API. */
(function () {
  'use strict';
  const G=window.BoundaryGeometry, $=id=>document.getElementById(id), svg=$('mapCanvas'), ns='http://www.w3.org/2000/svg';
  let doc,base,selected=null,mode='select',cut=[],undo=[],redo=[],dirty=false,version=0,cloudReady=false,busy=false;
  let view=[0,0,1,1],gesture=null,storageOK=true;
  let savedGeometry='';
  const ids={nanzih:'楠梓',chiaotou:'橋頭',tzuguan:'梓官'};
  const key=id=>'boundary-editor-v1:'+id;
  const api=id=>'/api/map-boundary-drafts/'+id;
  const message=text=>$('message').textContent=text;
  const path=polys=>polys.map(p=>p.map(r=>'M'+r.map(p=>p.join(',')).join(' L')+' Z').join(' ')).join(' ');
  const element=(tag,attrs)=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
  function backup() {
    if(!doc)return true;
    try {localStorage.setItem(key(doc.mapId),JSON.stringify({document:doc,baseVersion:version,dirty,savedAt:new Date().toISOString()}));storageOK=true;return true;}
    catch {storageOK=false;message('瀏覽器無法保留本機備份，請立即匯出 JSON 或儲存到雲端。');return false;}
  }
  function readBackup(id) {try {return JSON.parse(localStorage.getItem(key(id))||'null');}catch{return null;}}
  function controls() {
    $('save').disabled=busy||!doc||!cloudReady||!dirty||cut.length>0;
    $('map').disabled=busy; $('loadCloud').disabled=busy||!doc; $('restore').disabled=busy;
    $('export').disabled=busy||!doc; $('import').disabled=busy;
    $('undo').disabled=busy||!undo.length; $('redo').disabled=busy||!redo.length;
    $('finish').disabled=busy||cut.length<2; $('cancel').disabled=busy||!cut.length; $('focus').disabled=!selected||busy;
    document.querySelectorAll('[data-mode]').forEach(b=>{b.disabled=busy||!doc;b.setAttribute('aria-pressed',String(mode===b.dataset.mode));});
    $('saveState').textContent=busy?'處理中…':!doc?'未載入':`${dirty?'未儲存至雲端':'目前無未存修改'} · ${cloudReady?'雲端版本 '+version:'雲端未連線'}`;
    $('hint').textContent=mode==='cut'?'逐點補線：由選取區塊邊界外開始，沿缺口畫到另一側邊界外，再按「完成補線」。Esc 取消。':mode==='vertex'?'拖曳白色頂點調整邊界；放大選取區後較容易操作。若產生交叉或重疊，會保留原位置。':'點選色塊；拖曳可平移，滾輪可縮放。Ctrl / ⌘ + Z 復原。';
  }
  function render() {
    if(!doc){controls();return;}
    const region=$('regions');region.replaceChildren();
    for(const c of doc.candidates) {
      const e=element('path',{d:path(c.polygons),fill:c.issues.length?'#f97316':'#22c55e','fill-opacity':$('overlay').checked?'.18':'0',stroke:c.candidateId===selected?'#38bdf8':($('overlay').checked?(c.issues.length?'#ea580c':'#16a34a'):'transparent'),'fill-rule':'evenodd',class:'region'+(c.candidateId===selected?' selected':''),'data-id':c.candidateId});
      const title=element('title',{});title.textContent='編號 '+(c.numberCandidates.join('、')||'未配對');e.append(title);
      region.append(e);
    }
    const labels=$('labels');labels.replaceChildren();
    if($('anchors').checked)for(const a of doc.labelAnchors)labels.append(element('circle',{cx:a.point[0],cy:a.point[1],r:view[2]/Math.max(svg.clientWidth,1)*2.5,fill:'#e11d48'}));
    drawHandles();drawCut();controls();
    const c=doc.candidates.find(c=>c.candidateId===selected);
    const issueNames={'image-edge':'碰圖片邊緣','multiple-numbers':'多個編號合併','no-number':'尚未配對編號'};
    $('selection').textContent=c?`選取：${c.numberCandidates.join('、')||'未配對編號'}｜${c.issues.map(i=>issueNames[i]||i).join('、')||'單一編號'}｜仍待核對`:'尚未選取區塊';
    $('summary').textContent=`${doc.candidates.length} 塊候選 · ${doc.summary.singleNumberInteriorCandidates} 塊單一編號`;
  }
  function drawHandles() {
    const group=$('vertices');group.replaceChildren();if(mode!=='vertex')return;
    const c=doc.candidates.find(c=>c.candidateId===selected);if(!c)return;
    const r=view[2]/Math.max(svg.clientWidth,1)*5;
    c.polygons.forEach((poly,pi)=>poly.forEach((ring,ri)=>ring.slice(0,-1).forEach(([x,y],vi)=>{
      if(x<view[0]-r||x>view[0]+view[2]+r||y<view[1]-r||y>view[1]+view[3]+r)return;
      group.append(element('circle',{cx:x,cy:y,r,class:'handle','data-pi':pi,'data-ri':ri,'data-vi':vi}));
    })));
  }
  function drawCut() {
    $('cutLine').replaceChildren();if(!cut.length)return;
    $('cutLine').append(element('polyline',{points:cut.map(p=>p.join(',')).join(' '),class:'cut'}));
    for(const [x,y] of cut)$('cutLine').append(element('circle',{cx:x,cy:y,r:view[2]/Math.max(svg.clientWidth,1)*4,fill:'#e11d48','pointer-events':'none'}));
  }
  function setView(next) {view=next;svg.setAttribute('viewBox',view.join(' '));if(doc){drawHandles();drawCut();}}
  function fit() {if(!doc)return;const [w,h]=doc.imageSize;const ratio=svg.clientWidth/Math.max(svg.clientHeight,1);const vw=Math.max(w,h*ratio),vh=vw/ratio;setView([(w-vw)/2,(h-vh)/2,vw,vh]);}
  function zoom(factor,center=[view[0]+view[2]/2,view[1]+view[3]/2]) {if(!doc)return;const w=view[2]*factor;if(w<40||w>doc.imageSize[0]*5)return;setView([center[0]+(view[0]-center[0])*factor,center[1]+(view[1]-center[1])*factor,w,view[3]*factor]);}
  function point(event) {const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const v=p.matrixTransform(svg.getScreenCTM().inverse());return [v.x,v.y];}
  function commit(next) {undo.push(G.clone(doc));if(undo.length>20)undo.shift();redo=[];doc=next;dirty=JSON.stringify(doc.candidates)!==savedGeometry;cut=[];backup();render();}
  function applyDocument(next) {doc=G.refresh(G.clone(G.validate(next,base)));selected=null;undo=[];redo=[];cut=[];render();}
  async function cloudRequest(id,options) {
    const response=await fetch(api(id),{cache:'no-store',...options});
    const contentType=response.headers.get('content-type')||'';
    const data=contentType.includes('application/json')?await response.json():{};
    if(!response.ok)throw new Error(data.error || (response.status===401?'請先登入管理員帳號。':response.status===403?'僅管理員可存取雲端草稿。':'目前是離線預覽或雲端尚未部署。請使用雲端版，修正可先匯出 JSON。'));
    return data;
  }
  async function openMap(id) {
    if(doc&&dirty&&!backup()){ $('map').value=doc.mapId;return; }
    busy=true;controls();message('');
    try {
      const response=await fetch(`/maps/reconstruction-v1/${id}.json`);if(!response.ok)throw new Error('無法載入原始候選。');
      base=await response.json();doc=G.refresh(G.clone(base));selected=null;undo=[];redo=[];cut=[];dirty=false;version=0;cloudReady=false;
      $('background').setAttribute('href','/maps/'+base.sourceImage);$('background').setAttribute('width',base.imageSize[0]);$('background').setAttribute('height',base.imageSize[1]);
      try {const result=await cloudRequest(id);cloudReady=true;if(result.draft){applyDocument(result.draft.document);version=result.draft.version;message(`已載入雲端版本 ${version}（${new Date(result.draft.updatedAt).toLocaleString()}）。`);}}
      catch(error){message(error.message);}
      const saved=readBackup(id);$('restore').hidden=!saved?.dirty;
      savedGeometry=JSON.stringify(doc.candidates);
      if(saved?.dirty)message($('message').textContent+' 此裝置另有未存備份，可按「恢復本機備份」。');
      fit();render();
    }catch(error){message(error.message);if(doc)$('map').value=doc.mapId;}
    finally {busy=false;controls();}
  }
  $('map').onchange=()=>openMap($('map').value);
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{
    if(b.dataset.mode!=='select'&&!selected){message('請先點選一塊要修正的色塊。');return;}
    mode=b.dataset.mode;cut=[];message('');render();
  });
  $('finish').onclick=()=>{try {const next=G.split(doc,selected,cut,crypto.randomUUID());commit(next);selected=null;mode='select';message('已切開區塊並重新配對編號，請核對後儲存到雲端。');render();}catch(error){message(error.message);}};
  $('cancel').onclick=()=>{cut=[];render();};
  function history(back) {if(busy||!doc)return;const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;to.push(G.clone(doc));doc=from.pop();dirty=JSON.stringify(doc.candidates)!==savedGeometry;selected=null;cut=[];backup();render();}
  $('undo').onclick=()=>history(true);$('redo').onclick=()=>history(false);
  $('overlay').onchange=render;$('anchors').onchange=render;
  $('plus').onclick=()=>zoom(.7);$('minus').onclick=()=>zoom(1/.7);$('fit').onclick=fit;
  $('focus').onclick=()=>{const c=doc.candidates.find(c=>c.candidateId===selected);if(!c)return;const pts=c.polygons.flat(2);const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;const ratio=svg.clientWidth/Math.max(svg.clientHeight,1),vw=Math.max(w,h*ratio)*1.15;setView([x+w/2-vw/2,y+h/2-vw/ratio/2,vw,vw/ratio]);};
  svg.addEventListener('wheel',e=>{e.preventDefault();if(!busy)zoom(e.deltaY>0?1.15:1/1.15,point(e));},{passive:false});
  svg.addEventListener('pointerdown',e=>{
    if(busy||!doc||e.button!==0)return;
    const p=point(e),target=e.target;
    if(mode==='cut') {if(p[0]<0||p[1]<0||p[0]>=doc.imageSize[0]||p[1]>=doc.imageSize[1])return;cut.push(p);drawCut();controls();return;}
    if(target.classList.contains('handle')) {
      const pi=Number(target.dataset.pi),ri=Number(target.dataset.ri),vi=Number(target.dataset.vi),c=doc.candidates.find(c=>c.candidateId===selected);
      gesture={kind:'vertex',pi,ri,vi,preview:G.clone(c.polygons),node:target,start:p};
    }else gesture={kind:'pan',start:[e.clientX,e.clientY],view:view.slice(),id:target.dataset.id,moved:false};
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove',e=>{
    if(!gesture)return;
    if(gesture.kind==='pan') {const dx=e.clientX-gesture.start[0],dy=e.clientY-gesture.start[1];gesture.moved ||= Math.hypot(dx,dy)>4;const scale=gesture.view[2]/svg.clientWidth;setView([gesture.view[0]-dx*scale,gesture.view[1]-dy*scale,gesture.view[2],gesture.view[3]]);}
    else {const p=point(e),r=gesture.preview[gesture.pi][gesture.ri];r[gesture.vi]=p;if(gesture.vi===0)r[r.length-1]=p;gesture.node.setAttribute('cx',p[0]);gesture.node.setAttribute('cy',p[1]);$('regions').querySelector('.selected').setAttribute('d',path(gesture.preview));}
  });
  svg.addEventListener('pointerup',e=>{
    if(!gesture)return;const g=gesture;gesture=null;
    if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
    if(g.kind==='pan'){if(!g.moved&&g.id){selected=g.id;cut=[];message('');render();}}
    else {const p=point(e);if(Math.hypot(p[0]-g.start[0],p[1]-g.start[1])<.01){render();return;}try{commit(G.move(doc,selected,g.pi,g.ri,g.vi,p));message('頂點已調整，尚未儲存到雲端。');}catch(error){message(error.message);render();}}
  });
  svg.addEventListener('pointercancel',()=>{gesture=null;render();});
  document.addEventListener('keydown',e=>{if(e.target.matches('input,select')||busy)return;if(e.key==='Escape'){cut=[];gesture=null;render();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(!e.shiftKey);}if(e.key==='Enter'&&mode==='cut'&&cut.length>=2)$('finish').click();});
  $('save').onclick=async()=>{
    busy=true;controls();message('');const snapshot=G.clone(doc);
    try {const result=await cloudRequest(doc.mapId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:version,document:snapshot})});version=result.saved.version;dirty=false;savedGeometry=JSON.stringify(doc.candidates);backup();$('restore').hidden=true;message(`已儲存到雲端版本 ${version}，其他裝置可載入。`);}
    catch(error){backup();message(error.message);}
    finally{busy=false;controls();}
  };
  $('loadCloud').onclick=async()=>{
    if((dirty||cut.length)&&!confirm('載入雲端會取代目前畫面。本機修正將保留為備份；建議先匯出 JSON。繼續？'))return;
    if(dirty&&!backup())return;busy=true;controls();
    try {const result=await cloudRequest(doc.mapId);applyDocument(result.draft?.document||base);version=result.draft?.version||0;dirty=false;savedGeometry=JSON.stringify(doc.candidates);cloudReady=true;$('restore').hidden=!readBackup(doc.mapId)?.dirty;message(`已載入雲端版本 ${version}。`);}
    catch(error){message(error.message);}finally{busy=false;controls();}
  };
  $('restore').onclick=()=>{
    const saved=readBackup(doc.mapId);if(!saved)return;
    if(dirty&&!confirm('以先前本機備份取代目前修正？建議先匯出目前 JSON。'))return;
    try {applyDocument(saved.document);version=saved.baseVersion;dirty=JSON.stringify(doc.candidates)!==savedGeometry;backup();$('restore').hidden=!dirty;message('已恢復本機備份；若其他裝置已更新，儲存時會提示版本衝突。');controls();}catch(error){message(error.message);}
  };
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify({...doc,editorBackup:{baseVersion:version}},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${doc.mapId}-corrections-v${version}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message(cut.length?'已匯出已完成修正；正在繪製的補線尚未包含。':'已匯出修正 JSON。');};
  $('import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>2_000_000){message('檔案超過 2 MB。');return;}if(dirty&&!confirm('匯入將取代目前修正，請先確認已備份。'))return;
    busy=true;controls();try{const next=JSON.parse(await file.text());G.validate(next,base);if(next.editorBackup && (!Number.isSafeInteger(next.editorBackup.baseVersion)||next.editorBackup.baseVersion<0))throw new Error('備份版本無效。');const previousVersion=version;commit(G.refresh(next));version=next.editorBackup?.baseVersion??previousVersion;backup();message('已匯入修正，請核對後儲存到雲端。');}catch(error){message(error.message);}finally{busy=false;controls();}};
  window.addEventListener('beforeunload',e=>{if(dirty||cut.length){e.preventDefault();e.returnValue='';}});
  new ResizeObserver(()=>{if(doc)drawHandles();}).observe(svg);
  if(location.port==='18832')$('login').href='https://congregation-management-system.vercel.app/map/boundary-editor';
  const requested=new URLSearchParams(location.search).get('map');if(requested&&ids[requested])$('map').value=requested;
  openMap($('map').value);
})();
