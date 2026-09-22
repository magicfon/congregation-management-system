/* Shared, offline geometry operations. Pixel coordinates, never geographic coordinates. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/polygon-clipping.js'));
  else root.BoundaryGeometry = factory(root.polygonClipping);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (clip) {
  'use strict';
  const clone = d => JSON.parse(JSON.stringify(d));
  const eq = (a,b) => a[0]===b[0] && a[1]===b[1];
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function ringArea(r) { let a=0; for(let i=1;i<r.length;i++) a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1]; return Math.abs(a/2); }
  function area(polys) { return polys.reduce((a,p)=>a+ringArea(p[0])-p.slice(1).reduce((s,r)=>s+ringArea(r),0),0); }
  function insideRing(p,r) { let hit=false; for(let i=0,j=r.length-2;i<r.length-1;j=i++) { const a=r[i],b=r[j]; if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) hit=!hit; } return hit; }
  function inside(p,polys) { return polys.some(poly=>insideRing(p,poly[0]) && !poly.slice(1).some(r=>insideRing(p,r))); }
  function intersects(a,b,c,d) {
    if(Math.max(a[0],b[0])<Math.min(c[0],d[0]) || Math.max(c[0],d[0])<Math.min(a[0],b[0]) || Math.max(a[1],b[1])<Math.min(c[1],d[1]) || Math.max(c[1],d[1])<Math.min(a[1],b[1])) return false;
    return cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0;
  }
  function simple(r) {
    for(let i=0;i<r.length-1;i++) for(let j=i+2;j<r.length-1;j++) {
      if(i===0 && j===r.length-2) continue;
      if(intersects(r[i],r[i+1],r[j],r[j+1])) return false;
    }
    return ringArea(r)>1;
  }
  function validate(d,base) {
    const fail=()=>{throw new Error('JSON 格式、原圖版本或座標不符，未載入。');};
    if(!d || d.schemaVersion!==1 || d.mapId!==base.mapId || d.sourceSha256!==base.sourceSha256 || JSON.stringify(d.imageSize)!==JSON.stringify(base.imageSize) || d.coordinateSystem?.type!=='image-pixel' || d.coordinateSystem?.order!=='xy' || d.coordinateSystem?.origin!=='top-left' || d.coordinateSystem?.yDirection!=='down') fail();
    if(!Array.isArray(d.candidates) || d.candidates.length>2000 || !Array.isArray(d.labelAnchors) || d.labelAnchors.length!==base.labelAnchors.length) fail();
    // PostgreSQL JSONB may reorder object keys. Compare anchor values, not serialization order.
    if(d.labelAnchors.some((a,i)=>!a || a.number!==base.labelAnchors[i].number || a.component!==base.labelAnchors[i].component || !Array.isArray(a.point) || a.point.length!==2 || !eq(a.point,base.labelAnchors[i].point))) fail();
    let count=0; const ids=new Set();
    const originalRings=new Set(base.candidates.flatMap(c=>c.polygons.flatMap(p=>p.map(r=>JSON.stringify(r)))));
    for(const c of d.candidates) {
      if(typeof c.candidateId!=='string' || !/^[a-zA-Z0-9_-]{1,140}$/.test(c.candidateId) || ids.has(c.candidateId) || !Array.isArray(c.polygons) || !c.polygons.length) fail();
      ids.add(c.candidateId);
      for(const poly of c.polygons) {
        if(!Array.isArray(poly) || !poly.length) fail();
        for(const r of poly) {
          if(!Array.isArray(r) || r.length<4 || !Array.isArray(r[0]) || !Array.isArray(r[r.length-1]) || !eq(r[0],r[r.length-1])) fail();
          count+=r.length; if(count>30000 || r.length>5000) fail();
          for(const p of r) if(!Array.isArray(p) || p.length!==2 || !p.every(Number.isFinite) || p[0]<0 || p[1]<0 || p[0]>=d.imageSize[0] || p[1]>=d.imageSize[1]) fail();
          if(!originalRings.has(JSON.stringify(r)) && !simple(r)) throw new Error('匯入的修正邊界有交叉或無效區塊。');
        }
      }
      const unchanged=base.candidates.some(original=>JSON.stringify(original.polygons)===JSON.stringify(c.polygons));
      if(!unchanged && Math.abs(area(c.polygons)-area(clip.union(c.polygons)))>.05) throw new Error('修正區塊的內洞或多部件有重疊、超出外界。');
    }
    return d;
  }
  function refresh(doc) {
    const [w,h]=doc.imageSize;
    for(const c of doc.candidates) {
      c.numberCandidates=[...new Set(doc.labelAnchors.filter(a=>inside(a.point,c.polygons)).map(a=>a.number))].sort((a,b)=>a-b);
      c.issues=[];
      if(c.polygons.some(p=>p[0].some(([x,y])=>x<5||y<5||x>w-5||y>h-5))) c.issues.push('image-edge');
      if(!c.numberCandidates.length)c.issues.push('no-number');
      if(c.numberCandidates.length>1)c.issues.push('multiple-numbers');
      c.status='needs-review'; c.pixelArea=Math.round(area(c.polygons));
    }
    const covered=new Set(doc.candidates.flatMap(c=>c.numberCandidates));
    doc.summary={...doc.summary,candidateCount:doc.candidates.length,approvedCount:0,
      singleNumberInteriorCandidates:doc.candidates.filter(c=>!c.issues.length).length,
      mergedNumberGroups:doc.candidates.filter(c=>c.numberCandidates.length>1).map(c=>c.numberCandidates),
      edgeCandidates:doc.candidates.filter(c=>c.issues.includes('image-edge')).length,
      unmatchedLabelNumbers:[...new Set(doc.labelAnchors.map(a=>a.number))].filter(n=>!covered.has(n))};
    return doc;
  }
  function record(doc,edit) { doc.correctionLog=[...(doc.correctionLog||[]),{...edit,at:new Date().toISOString()}].slice(-500); }
  function split(doc,id,points,nonce) {
    if(points.length<2) throw new Error('請至少畫兩個點。');
    const original=doc.candidates.find(c=>c.candidateId===id);
    if(!original)throw new Error('請先選取要補線的色塊。');
    const cutters=[];
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      if(length<0.01)continue;
      const nx=-dy/length,ny=dx/length,tx=dx/length,ty=dy/length;
      cutters.push([[[a[0]-tx+nx,a[1]-ty+ny],[b[0]+tx+nx,b[1]+ty+ny],[b[0]+tx-nx,b[1]+ty-ny],[a[0]-tx-nx,a[1]-ty-ny],[a[0]-tx+nx,a[1]-ty+ny]]]);
    }
    if(!cutters.length)throw new Error('補線太短。');
    const normalized=clip.union(original.polygons);
    const result=clip.difference(normalized,...cutters);
    if(result.length<=normalized.length)throw new Error('補線尚未切開區塊。請從邊界外開始，沿缺口畫到另一側邊界外。');
    if(result.some(p=>area([p])<4))throw new Error('切割產生過小碎片，請調整補線位置。');
    const next=clone(doc),index=next.candidates.findIndex(c=>c.candidateId===id);
    const children=result.map((p,i)=>({candidateId:`${doc.mapId}-edit-${nonce}-${i}`,polygons:[p],status:'needs-review',numberCandidates:[],issues:[],pixelArea:0,parentCandidateId:id}));
    next.candidates.splice(index,1,...children); record(next,{type:'split',candidateId:id,points,wallWidth:2});
    return refresh(next);
  }
  function move(doc,id,polyIndex,ringIndex,index,point) {
    const next=clone(doc),c=next.candidates.find(c=>c.candidateId===id),poly=c.polygons[polyIndex],r=poly[ringIndex];
    if(!point.every(Number.isFinite) || point[0]<0||point[1]<0||point[0]>=doc.imageSize[0]||point[1]>=doc.imageSize[1])throw new Error('頂點不可超出圖片。');
    r[index]=point; if(index===0)r[r.length-1]=point.slice();
    validateEdit(doc,next,id,polyIndex,ringIndex);
    record(next,{type:'move-vertex',candidateId:id,polyIndex,ringIndex,index,point});
    return refresh(next);
  }
  function removeCandidate(doc,id) {
    if(!doc.candidates.some(c=>c.candidateId===id))throw new Error('請先選取要刪除的區塊。');
    const next=clone(doc);
    next.candidates=next.candidates.filter(c=>c.candidateId!==id);
    record(next,{type:'delete-candidate',candidateId:id});
    return refresh(next);
  }
  function removeVertex(doc,id,polyIndex,ringIndex,index) {
    const next=clone(doc),c=next.candidates.find(c=>c.candidateId===id);
    const r=c?.polygons[polyIndex]?.[ringIndex];
    if(!r || !Number.isInteger(index) || index<0 || index>=r.length-1)throw new Error('請先點選要刪除的頂點。');
    if(r.length<=4)throw new Error('每個封閉邊界至少保留 3 個頂點。');
    r.pop();r.splice(index,1);r.push(r[0].slice());
    validateEdit(doc,next,id,polyIndex,ringIndex);
    record(next,{type:'delete-vertex',candidateId:id,polyIndex,ringIndex,index});
    return refresh(next);
  }
  function validateEdit(doc,next,id,polyIndex,ringIndex) {
    const c=next.candidates.find(c=>c.candidateId===id),poly=c.polygons[polyIndex],r=poly[ringIndex];
    if(!simple(r))throw new Error('頂點修改造成交叉或無效區塊，已保留原邊界。');
    for(let j=0;j<poly.length;j++) {
      if(j===ringIndex)continue;
      const other=poly[j];
      for(let a=1;a<r.length;a++)for(let b=1;b<other.length;b++)if(intersects(r[a-1],r[a],other[b-1],other[b]))throw new Error('邊界不可穿過內洞或其他邊界。');
    }
    if(poly.slice(1).some(h=>!insideRing(h[0],poly[0])))throw new Error('內洞必須留在外圍邊界內。');
    for(let i=1;i<poly.length;i++)for(let j=i+1;j<poly.length;j++)if(insideRing(poly[i][0],poly[j])||insideRing(poly[j][0],poly[i]))throw new Error('內洞不可重疊。');
    // Preserve existing gaps; a vertex move must not create an overlap with neighbours.
    const before=doc.candidates.find(x=>x.candidateId===id);
    const others=doc.candidates.filter(x=>x.candidateId!==id).flatMap(x=>x.polygons);
    if(others.length && area(clip.intersection(c.polygons,others))>area(clip.intersection(before.polygons,others))+0.01)throw new Error('移動後與相鄰區塊重疊，請縮小移動範圍。');
  }
  return {clone,area,inside,validate,refresh,split,move,removeVertex,removeCandidate};
});
