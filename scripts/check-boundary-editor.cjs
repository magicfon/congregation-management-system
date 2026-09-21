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
  for(const base of Object.values(originals)) G.validate(base,base)
  const base=fixture([[ring(20,20,60,60)]]), original=JSON.stringify(base)
  const split=G.split(base,'one',[[50,10],[50,90]],'first')
  assert.equal(split.candidates.length,2)
  assert.deepEqual(split.candidates.map(c=>c.numberCandidates).sort((a,b)=>a[0]-b[0]),[[1],[2]])
  assert.equal(G.area(split.candidates.flatMap(c=>c.polygons)),3480) // 2px x 60px wall
  assert.equal(JSON.stringify(base),original)
  G.validate(split,base)
  const badHole=G.clone(base);badHole.candidates[0].polygons[0].push(ring(10,30,20,20));assert.throws(()=>G.validate(badHole,base),/內洞/)
  const crossed=G.clone(base);crossed.candidates[0].polygons[0][0]=[[20,20],[80,80],[80,20],[20,80],[20,20]];assert.throws(()=>G.validate(crossed,base),/交叉/)
  assert.throws(()=>G.split(base,'one',[[30,30],[35,35]],'no'),/尚未切開/)
  assert.throws(()=>G.split(base,'one',[[1,1],[1,90]],'no'),/尚未切開/)
  const hole=fixture([[ring(20,20,60,60),ring(30,40,10,10)]])
  const withHole=G.split(hole,'one',[[50,10],[50,90]],'hole')
  assert.equal(withHole.candidates.length,2)
  assert(!G.inside([35,45],withHole.candidates.flatMap(c=>c.polygons)))
  assert.equal(G.area(withHole.candidates.flatMap(c=>c.polygons)),3380)
  const throughHole=G.split(hole,'one',[[35,10],[35,90]],'through-hole')
  assert.equal(throughHole.candidates.length,2)
  assert(!G.inside([38,45],throughHole.candidates.flatMap(c=>c.polygons)))
  const bent=G.split(base,'one',[[50,10],[40,50],[50,90]],'bent')
  assert.equal(bent.candidates.length,2)
  const concave=fixture([[[[20,20],[80,20],[80,80],[60,80],[60,40],[40,40],[40,80],[20,80],[20,20]]]])
  assert.equal(G.split(concave,'one',[[10,60],[90,60]],'concave').candidates.length,3)
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
  assert.throws(()=>G.removeVertex(withNeighbour,'one',0,1,0),/重疊/)
  assert.deepEqual(moved.candidates[0].polygons[0][0][0],[22,22])
  assert.deepEqual(moved.candidates[0].polygons[0][0].at(-1),[22,22])
  assert.throws(()=>G.move(base,'one',0,0,1,[10,70]),/交叉/)
  assert.throws(()=>G.move(base,'one',0,0,0,[-1,20]),/圖片/)
  assert.throws(()=>G.move(hole,'one',0,1,0,[10,10]),/邊界|內洞/)
  const overlap=G.clone(base);overlap.candidates.push({candidateId:'neighbor',polygons:[[ring(82,20,10,60)]]})
  assert.throws(()=>G.move(overlap,'one',0,0,1,[90,20]),/重疊/)
  for(const alter of [d=>d.sourceSha256='bad',d=>d.imageSize=[10,10],d=>d.candidates[0].polygons[0][0][1]=[Infinity,1],d=>d.labelAnchors=[]]){
    const d=G.clone(originals.nanzih);alter(d);assert.throws(()=>G.validate(d,originals.nanzih))
  }
  const validation=load('src/lib/boundary-drafts.ts',{'../../public/tools/boundary-editor/geometry':G,...Object.fromEntries(Object.entries(originals).map(([id,d])=>[`../../public/maps/reconstruction-v1/${id}.json`,d]))})
  const {NextRequest,NextResponse}=require('next/server')
  let role='admin',rows=new Map(),writes=0
  const route=load('src/app/api/map-boundary-drafts/[mapId]/route.ts',{
    '../../../../lib/api-auth':{requireApiUser:async roles=>role==='admin'?{user:{id:'admin-test',role}}:{response:NextResponse.json({error:'denied'},{status:role==='anonymous'?401:403})}},
    '../../../../lib/boundary-drafts':validation,
    '../../../../lib/db':{prisma:{$queryRaw:async(strings,...values)=>{
      const sql=strings.join('?')
      if(sql.startsWith('SELECT'))return rows.has(values[0])?[rows.get(values[0])]:[]
      writes++
      const insert=sql.startsWith('INSERT'),id=insert?values[0]:values[2],expected=insert?0:values[3],current=rows.get(id)
      if((current?.version||0)!==expected)return []
      const saved={mapId:id,document:JSON.parse(insert?values[1]:values[0]),version:expected+1,updatedAt:new Date(),updatedBy:'admin-test'};rows.set(id,saved);return [saved]
    }}},
  })
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
  assert.equal(read.draft.version,2);assert.equal(read.draft.document.summary.approvedCount,0)
  const foreign=await route.PUT(new NextRequest(url,{method:'PUT',headers:{'content-type':'application/json',origin:'https://other.example'},body:'{}'}),context)
  assert.equal(foreign.status,403)
  console.log('PASS: split, holes, concave geometry, vertex edits, overlap rejection, import bounds/source, admin access, atomic version conflict contract.')
  console.log('Database calls mocked: live Neon migration and persistence require deployment verification.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
