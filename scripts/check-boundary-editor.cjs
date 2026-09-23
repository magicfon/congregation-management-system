// Isolated checks: no database credentials, network writes or production data changes.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const G = require('../public/tools/boundary-editor/geometry.js')
const originals = Object.fromEntries(['nanzih','chiaotou','tzuguan'].map(id=>[id,require(`../public/maps/reconstruction-v1/${id}.json`)]))
const ring = (x,y,w,h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]
const fixture = polys => G.refresh({schemaVersion:1,mapId:'test',sourceSha256:'test',imageSize:[100,100],coordinateSystem:{type:'image-pixel',order:'xy',origin:'top-left',yDirection:'down'},labelAnchors:[{number:1,point:[30,30]},{number:2,point:[70,30]}],summary:{},candidates:[{candidateId:'one',polygons:polys}]})
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,require:id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),console,Buffer,URL,process},{filename:file});return exports;}
async function main(){
  for(const base of Object.values(originals)) {G.validate(base,base);G.validate(G.independentBlocks(base),base)}
  const jsonb=x=>Array.isArray(x)?x.map(jsonb):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,jsonb(x[k])])):x
  for(const base of Object.values(originals)) G.validate(jsonb(base),base)
  const base=fixture([[ring(20,20,60,60)]]), original=JSON.stringify(base)
  const split=G.split(base,'one',[[50,10],[50,90]],'first')
  assert.equal(split.candidates.length,2)
  assert.deepEqual(split.candidates.map(c=>c.numberCandidates).sort((a,b)=>a[0]-b[0]),[[1],[2]])
  assert.equal(G.area(split.candidates.flatMap(c=>c.polygons)),3480) // 2px x 60px wall
  assert.equal(JSON.stringify(base),original)
  G.validate(split,base)
  const removed=G.removeCandidate(split,split.candidates[0].candidateId)
  assert.equal(removed.candidates.length,1)
  assert.deepEqual(removed.candidates[0],split.candidates[1])
  assert.equal(split.candidates.length,2,'刪除不得改動復原用的原始資料')
  assert.deepEqual(removed.summary.unmatchedLabelNumbers,[1])
  const empty=G.removeCandidate(removed,removed.candidates[0].candidateId)
  G.validate(jsonb(empty),base)
  assert.equal(empty.summary.candidateCount,0)
  assert.deepEqual(empty.summary.unmatchedLabelNumbers,[1,2])
  assert.throws(()=>G.removeCandidate(split,'missing'),/選取/)

  const badHole=G.clone(base);badHole.candidates[0].polygons[0].push(ring(10,30,20,20));assert.throws(()=>G.validate(badHole,base),/內洞/)
  const crossed=G.clone(base);crossed.candidates[0].polygons[0][0]=[[20,20],[80,80],[80,20],[20,80],[20,20]];assert.throws(()=>G.validate(crossed,base),/交叉/)
  assert.throws(()=>G.split(base,'one',[[30,30],[35,35]],'no'),/尚未切開/)
  assert.throws(()=>G.split(base,'one',[[1,1],[1,90]],'no'),/尚未切開/)
  const hole=fixture([[ring(20,20,60,60),ring(30,40,10,10)]])
  const withHole=G.split(hole,'one',[[50,10],[50,90]],'hole')
  assert.equal(withHole.candidates.length,2)
  assert(!G.inside([35,45],withHole.candidates.flatMap(c=>c.polygons)))
  assert.equal(G.area(withHole.candidates.flatMap(c=>c.polygons)),3380)
  const independent=G.independentBlocks(hole),outer=G.clone(independent.candidates[0].polygons);
  assert.equal(independent.candidates.length,2);assert.equal(independent.candidates[0].polygons[0].length,1);
  assert.equal(G.area(independent.candidates[0].polygons),3600);
  const child=independent.candidates[1];assert.equal(G.area(child.polygons),100);
  const removedInner=G.removeCandidate(independent,child.candidateId);
  assert.deepEqual(removedInner.candidates[0].polygons,outer);
  assert.deepEqual(G.independentBlocks(removedInner),removedInner,'不得重建已刪除區塊');
  G.validate(independent,hole);
  const real58=G.independentBlocks(originals.nanzih),parent58=originals.nanzih.candidates.find(c=>c.numberCandidates.includes(58)).candidateId;
  assert.equal(real58.candidates.filter(c=>c.candidateId.startsWith(parent58+'-inner-')).length,8);
  assert.equal(real58.candidates.find(c=>c.candidateId===parent58).polygons[0].length,1);
  G.validate(real58,originals.nanzih);
  const throughHole=G.split(hole,'one',[[35,10],[35,90]],'through-hole')
  assert.equal(throughHole.candidates.length,2)
  assert(!G.inside([38,45],throughHole.candidates.flatMap(c=>c.polygons)))
  const bent=G.split(base,'one',[[50,10],[40,50],[50,90]],'bent')
  assert.equal(bent.candidates.length,2)
  const concave=fixture([[[[20,20],[80,20],[80,80],[60,80],[60,40],[40,40],[40,80],[20,80],[20,20]]]])
  assert.equal(G.split(concave,'one',[[10,60],[90,60]],'concave').candidates.length,3)
  const dense=fixture([[[[20,20],[30,21],[40,19],[50,21],[60,20],[80,20],[80,80],[20,80],[20,20]]]])
  const pick=indices=>indices.map(vi=>({pi:0,ri:0,vi}))
  const denseOriginal=JSON.stringify(dense)
  const smooth=G.batchVertices(dense,'one',pick([0,1,2,3,4]),'smooth',3)
  assert(smooth.candidates[0].polygons[0][0].length<dense.candidates[0].polygons[0][0].length)
  for(const point of [[20,20],[60,20],[80,20],[80,80],[20,80]])assert(smooth.candidates[0].polygons[0][0].some(p=>JSON.stringify(p)===JSON.stringify(point)))
  G.validate(smooth,dense)
  const mapped=G.batchVertexEdit(dense,'one',pick([0,1,2,3,4]),'smooth',3);
  assert.deepEqual(mapped.selection,pick([0,1]));
  const afterSelectedDelete=G.batchVertices(mapped.document,'one',mapped.selection,'delete');
  assert.equal(afterSelectedDelete.candidates[0].polygons[0][0].length,4);
  const wrappedSelection=G.batchVertexEdit(dense,'one',pick([6,7,0,1,2]),'smooth',1);
  for(const v of wrappedSelection.selection)assert(v.vi<wrappedSelection.document.candidates[0].polygons[v.pi][v.ri].length-1);
  const deletedBatch=G.batchVertices(dense,'one',pick([1,2,3]),'delete')
  assert.equal(deletedBatch.candidates[0].polygons[0][0].length,6)
  const wrapped=G.batchVertices(dense,'one',pick([7,0,1]),'delete')
  G.validate(wrapped,dense)
  const all=G.batchVertices(dense,'one',pick([0,1,2,3,4,5,6,7]),'smooth')
  G.validate(all,dense)
  assert(all.candidates[0].polygons[0][0].length>=4)
  assert.throws(()=>G.batchVertices(dense,'one',pick([0,1,2,3,4,5]),'delete'),/至少保留/)
  assert.throws(()=>G.batchVertices(hole,'one',[{pi:0,ri:0,vi:0},{pi:0,ri:1,vi:0},{pi:0,ri:1,vi:1}],'delete'),/至少保留/)
  assert.equal(JSON.stringify(dense),denseOriginal)
  const disjoint=G.batchVertices(dense,'one',pick([1,3]),'delete')
  assert.equal(disjoint.candidates[0].polygons[0][0].length,7)
  const rounded=G.batchVertices(dense,'one',pick([0,1,2,3,4,5,6,7]),'smooth',1)
  assert(rounded.candidates[0].polygons[0][0].some(p=>!dense.candidates[0].polygons[0][0].some(q=>JSON.stringify(p)===JSON.stringify(q))),'平滑必須圓滑座標，不只是刪點')
  assert.doesNotThrow(()=>G.batchVertices(G.refresh({...G.clone(hole),candidates:[...G.clone(hole.candidates),{candidateId:'inside-hole',polygons:[[ring(31,41,2,2)]]}]}),'one',[{pi:0,ri:1,vi:0}],'delete'))

  assert.throws(()=>G.batchVertices(dense,'one',pick([999]),'delete'),/失效/)
  const moved=G.move(base,'one',0,0,0,[22,22])
  for(const index of [0,1,3]) {
    const deleted=G.removeVertex(base,'one',0,0,index)
    const r=deleted.candidates[0].polygons[0][0]
    assert.equal(r.length,4);assert.deepEqual(r[0],r.at(-1))
    assert.equal(G.area(deleted.candidates[0].polygons),1800)
    assert.throws(()=>G.removeVertex(deleted,'one',0,0,0),/至少保留 3/)
    G.validate(deleted,base)
  }
  assert.equal(JSON.stringify(base),original)
  assert.throws(()=>G.removeVertex(base,'one',0,0,4),/點選/)
  const deletedHole=G.removeVertex(hole,'one',0,1,0)
  assert.equal(deletedHole.candidates[0].polygons[0][1].length,4)
  const withNeighbour=G.clone(hole)
  withNeighbour.candidates.push({candidateId:'inner-neighbor',polygons:[[ring(31,41,2,2)]]})
  assert.doesNotThrow(()=>G.removeVertex(withNeighbour,'one',0,1,0))
  assert.deepEqual(moved.candidates[0].polygons[0][0][0],[22,22])
  assert.deepEqual(moved.candidates[0].polygons[0][0].at(-1),[22,22])
  assert.throws(()=>G.move(base,'one',0,0,1,[10,70]),/交叉/)
  assert.throws(()=>G.move(base,'one',0,0,0,[-1,20]),/圖片/)
  assert.throws(()=>G.move(hole,'one',0,1,0,[10,10]),/邊界|內洞/)
  const overlap=G.clone(base);overlap.candidates.push({candidateId:'neighbor',polygons:[[ring(82,20,10,60)]]})
  assert.doesNotThrow(()=>G.move(overlap,'one',0,0,1,[90,20]))
  for(const alter of [d=>d.sourceSha256='bad',d=>d.imageSize=[10,10],d=>d.candidates[0].polygons[0][0][1]=[Infinity,1],d=>d.labelAnchors=[]]){
    const d=G.clone(originals.nanzih);alter(d);assert.throws(()=>G.validate(d,originals.nanzih))
  }
  const validation=load('src/lib/boundary-drafts.ts',{'../../public/tools/boundary-editor/geometry':G,...Object.fromEntries(Object.entries(originals).map(([id,d])=>[`../../public/maps/reconstruction-v1/${id}.json`,d]))})
  const {NextRequest,NextResponse}=require('next/server')
  let role='admin',rows=new Map(),writes=0
  const shared=load('src/lib/boundary-draft-api.ts',{
    './boundary-drafts':validation,
    './db':{prisma:{$queryRaw:async(strings,...values)=>{
      const sql=strings.join('?')
      if(sql.startsWith('SELECT'))return rows.has(values[0])?[rows.get(values[0])]:[]
      writes++
      const insert=sql.startsWith('INSERT'),id=insert?values[0]:values[2],expected=insert?0:values[3],current=rows.get(id)
      if((current?.version||0)!==expected)return []
      const saved={mapId:id,document:JSON.parse(insert?values[1]:values[0]),version:expected+1,updatedAt:new Date(),updatedBy:insert?values[2]:values[1]};rows.set(id,saved);return [saved]
    }}},
  })
  const route=load('src/app/api/map-boundary-drafts/[mapId]/route.ts',{
    '../../../../lib/api-auth':{requireApiUser:async roles=>role==='admin'?{user:{id:'admin-test',role}}:{response:NextResponse.json({error:'denied'},{status:role==='anonymous'?401:403})}},
    '../../../../lib/boundary-draft-api':shared,
  })
  const publicRoute=load('src/app/api/public/map-boundary-drafts/[mapId]/route.ts',{'../../../../../lib/boundary-draft-api':shared})
  const context={params:{mapId:'nanzih'}},url='http://localhost/api/map-boundary-drafts/nanzih'
  const put=(version,document=originals.nanzih)=>route.PUT(new NextRequest(url,{method:'PUT',headers:{'content-type':'application/json','origin':'http://localhost'},body:JSON.stringify({expectedVersion:version,document})}),context)
  role='anonymous';assert.equal((await put(0)).status,401)
  role='publisher';assert.equal((await put(0)).status,403);assert.equal((await route.GET(new NextRequest(url),context)).status,403);assert.equal(writes,0)
  role='admin'
  assert.equal((await put(-1)).status,400)
  assert.equal((await put(0,{...originals.nanzih,sourceSha256:'wrong'})).status,400)
  assert.equal(writes,0)
  assert.deepEqual((await Promise.all([put(0),put(0)])).map(r=>r.status).sort(),[200,409])
  assert.equal((await put(0)).status,409)
  assert.deepEqual((await Promise.all([put(1),put(1)])).map(r=>r.status).sort(),[200,409])
  const read=await (await route.GET(new NextRequest(url),context)).json()
  assert.equal(read.draft.document.boundaryModel,'independent-blocks-v1');assert.equal(read.draft.version,2);assert.equal(read.draft.document.summary.approvedCount,0)
  const foreign=await route.PUT(new NextRequest(url,{method:'PUT',headers:{'content-type':'application/json',origin:'https://other.example'},body:'{}'}),context)
  assert.equal(foreign.status,403)
  role='anonymous'
  const publicUrl='http://localhost/api/public/map-boundary-drafts/nanzih'
  const publicPut=version=>publicRoute.PUT(new NextRequest(publicUrl,{method:'PUT',headers:{'content-type':'application/json',origin:'http://localhost'},body:JSON.stringify({expectedVersion:version,document:G.independentBlocks(originals.nanzih)})}),context)
  const publicRead=await (await publicRoute.GET(new NextRequest(publicUrl),context)).json()
  assert.equal(publicRead.draft.version,2);assert.equal(publicRead.draft.updatedBy,undefined)
  assert.deepEqual((await Promise.all([publicPut(2),publicPut(2)])).map(r=>r.status).sort(),[200,409])
  assert.equal(rows.get('nanzih').updatedBy,'public-editor')
  assert.equal((await route.GET(new NextRequest(url),context)).status,401)
  role='admin';assert.equal((await put(2)).status,409)
  assert.equal((await publicRoute.GET(new NextRequest(publicUrl),{params:{mapId:'unknown'}})).status,404)
  assert.equal((await publicRoute.PUT(new NextRequest(publicUrl,{method:'PUT',headers:{'content-type':'application/json',origin:'https://other.example'},body:'{}'}),context)).status,403)
  assert.equal((await publicRoute.PUT(new NextRequest(publicUrl,{method:'PUT',headers:{'content-type':'application/json'},body:'{}'}),context)).status,400)
  console.log('PASS: split, holes, concave geometry, vertex edits, independent overlapping blocks, retained smoothing selection, import bounds/source, admin access, atomic version conflict contract.')
  console.log('Database calls mocked: live Neon migration and persistence require deployment verification.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
