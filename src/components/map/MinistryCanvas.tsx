'use client'
import { useRef, useState } from 'react'
import { Hand, Paintbrush, Eraser, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { eraseSweep } from '../../lib/ministry-eraser'
import type { Stroke } from '../../lib/ministry'
type View = { x: number; y: number; w: number; h: number }
export default function MinistryCanvas({ image, history, strokes, onChange, editable }: { image: { url: string; dims: number[] }; history: Stroke[][]; strokes: Stroke[]; onChange: (strokes: Stroke[]) => void; editable: boolean }) {
  const [w,h] = image.dims
  const svg = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, w, h })
  const [mode, setMode] = useState<'draw' | 'erase' | 'pan'>('pan')
  const [width, setWidth] = useState(.015)
  const [draft, setDraft] = useState<Stroke | null>(null)
  const [imageError, setImageError] = useState(false)
  const [erased, setErased] = useState<Stroke[] | null>(null)
  const eraseRef = useRef<Stroke[] | null>(null)
  const erasePoint = useRef<[number,number] | null>(null)
  const [undo, setUndo] = useState<Stroke[][]>([])
  const [limitError, setLimitError] = useState('')
  function commit(next: Stroke[]) {
    if (next === strokes) return
    if (next.length > 200 || next.reduce((n,s)=>n+s.points.length,0)>12000) { setLimitError('筆跡片段過多，這次操作未套用。請縮小擦除範圍。'); return }
    setLimitError(''); setUndo(previous=>[...previous.slice(-19),strokes]); onChange(next)
  }
  function eraseAt(p: [number,number]) {
    eraseRef.current=eraseSweep(eraseRef.current || strokes,erasePoint.current || p,p,width/2,h/w)
    erasePoint.current=p; setErased(eraseRef.current)
  }
  const draftRef = useRef<Stroke | null>(null)
  const pointers = useRef(new Map<number, [number,number]>())
  const gesture = useRef<{ view: View; start: [number,number]; distance: number; pinch: boolean; rect: { width: number; height: number } } | null>(null)
  const cancelled = useRef(false)
  function point(e: React.PointerEvent): [number,number] {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return [0,0]
    const p = new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse())
    return [Math.max(0,Math.min(1,p.x/w)),Math.max(0,Math.min(1,p.y/h))]
  }
  function start(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId,[e.clientX,e.clientY])
    if (pointers.current.size > 1) {
      draftRef.current=null;setDraft(null);eraseRef.current=null;erasePoint.current=null;setErased(null);cancelled.current=true
      const [a,b]=[...pointers.current.values()]
      gesture.current={view,start:[(a[0]+b[0])/2,(a[1]+b[1])/2],distance:Math.hypot(a[0]-b[0],a[1]-b[1]),pinch:true,rect:e.currentTarget.getBoundingClientRect()};return
    }
    cancelled.current=false
    if (mode==='erase' && editable && !imageError) { eraseRef.current=strokes; eraseAt(point(e)); return }
    if (mode==='draw' && editable && !imageError) {draftRef.current={width,points:[point(e)]};setDraft(draftRef.current)}
    else gesture.current={view,start:[e.clientX,e.clientY],distance:0,pinch:false,rect:e.currentTarget.getBoundingClientRect()}
  }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId,[e.clientX,e.clientY])
    const g=gesture.current
    if(g && (g.pinch ? pointers.current.size>=2 : !cancelled.current)) {
      const [a,b]=[...pointers.current.values()]
      const mid: [number,number]=g.pinch?[(a[0]+b[0])/2,(a[1]+b[1])/2]:a
      const ratio=g.pinch?Math.max(.25,Math.min(4,g.distance/Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1])))):1
      const nw=Math.max(w/12,Math.min(w*2,g.view.w*ratio)),nh=nw*h/w
      const units=Math.max(g.view.w/g.rect.width,g.view.h/g.rect.height)
      setView({x:g.view.x+(g.view.w-nw)/2-(mid[0]-g.start[0])*units,y:g.view.y+(g.view.h-nh)/2-(mid[1]-g.start[1])*units,w:nw,h:nh});return
    }
    if(eraseRef.current && pointers.current.size===1 && editable && !cancelled.current) { eraseAt(point(e)); return }
    if(draftRef.current && pointers.current.size===1 && editable && !cancelled.current) {
      const p=point(e),last=draftRef.current.points.at(-1)!
      if(Math.hypot(p[0]-last[0],p[1]-last[1])<.001 || draftRef.current.points.length>=4000)return
      draftRef.current={...draftRef.current,points:[...draftRef.current.points,p]};setDraft(draftRef.current)
    }
  }
  function end(e: React.PointerEvent<SVGSVGElement>, abort=false) {
    if(!pointers.current.has(e.pointerId))return
    if(!abort && editable && !cancelled.current && draftRef.current)commit([...strokes,draftRef.current])
    if(!abort && editable && !cancelled.current && eraseRef.current) commit(eraseRef.current)
    eraseRef.current=null;erasePoint.current=null;setErased(null)
    pointers.current.delete(e.pointerId);draftRef.current=null;setDraft(null)
    if(!pointers.current.size){gesture.current=null;cancelled.current=false}else cancelled.current=true
  }
  function zoom(factor: number){setView(v=>{const nw=Math.max(w/12,Math.min(w*2,v.w*factor)),nh=nw*h/w;return{x:v.x+(v.w-nw)/2,y:v.y+(v.h-nh)/2,w:nw,h:nh}})}
  function marks(items: Stroke[], color: string) { return items.map((s,i)=>s.points.length===1?<circle key={i} cx={s.points[0][0]*w} cy={s.points[0][1]*h} r={s.width*w/2} fill={color} />:<polyline key={i} points={s.points.map(p=>`${p[0]*w},${p[1]*h}`).join(' ')} fill="none" stroke={color} strokeWidth={s.width*w} strokeLinecap="round" strokeLinejoin="round" />) }
  return <div className="overflow-hidden rounded-xl border border-white/10 bg-mc-card">
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2 text-xs">
      <button type="button" aria-pressed={mode==='pan'} onClick={()=>setMode('pan')} className={`flex items-center gap-1 rounded-lg px-3 py-2 ${mode==='pan'?'bg-blue-400/20 text-blue-300':'bg-white/5'}`}><Hand size={15}/>瀏覽</button>
      {editable && <><button type="button" aria-pressed={mode==='draw'} disabled={imageError} onClick={()=>setMode('draw')} className={`flex items-center gap-1 rounded-lg px-3 py-2 ${mode==='draw'?'bg-blue-400/20 text-blue-300':'bg-white/5'}`}><Paintbrush size={15}/>塗畫</button><button type="button" aria-pressed={mode==='erase'} disabled={imageError} onClick={()=>setMode('erase')} className={`flex items-center gap-1 rounded-lg px-3 py-2 ${mode==='erase'?'bg-blue-400/20 text-blue-300':'bg-white/5'}`}><Eraser size={15}/>橡皮擦</button><label className="flex items-center gap-1">筆寬<select aria-label="筆刷寬度" value={width} onChange={e=>setWidth(Number(e.target.value))} className="rounded bg-mc-accent p-2"><option value={.007}>細</option><option value={.015}>中</option><option value={.035}>粗</option></select></label><button type="button" aria-label="復原上一步" disabled={!undo.length} onClick={()=>{const previous=undo.at(-1);if(previous){onChange(previous);setUndo(undo.slice(0,-1));setLimitError('')}}} className="rounded bg-white/5 p-2 disabled:opacity-30"><Undo2 size={16}/></button></>}
      <button type="button" aria-label="放大" onClick={()=>zoom(.8)} className="p-2"><ZoomIn size={17}/></button><button type="button" aria-label="縮小" onClick={()=>zoom(1.25)} className="p-2"><ZoomOut size={17}/></button><button type="button" onClick={()=>setView({x:0,y:0,w,h})} className="p-2">全圖</button>
    </div>
    <svg ref={svg} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="h-[55dvh] min-h-72 w-full touch-none select-none bg-slate-800 md:h-[68dvh]" aria-label="小地圖完成範圍；切換塗畫後可用手指或滑鼠標記" onPointerDown={start} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={e=>end(e,true)}>
      <image href={image.url} width={w} height={h} onError={()=>setImageError(true)}/>
      <g opacity=".35" pointerEvents="none">{history.map((s,i)=><g key={i}>{marks(s,'#22c55e')}</g>)}</g><g opacity=".5" pointerEvents="none">{marks(erased || strokes,'#3b82f6')}{draft&&marks([draft],'#3b82f6')}</g>
    </svg>
    {limitError&&<p role="alert" className="p-2 text-xs text-amber-300">{limitError}</p>}
    <p className="p-2 text-xs text-mc-text/50">{imageError?'小地圖載入失敗，請重新載入。可先用文字提交進度。':'綠色：已交接進度 · 藍色：本次筆跡。雙指可縮放／移動，單指塗畫／擦除自己的未提交筆跡。'}</p>
  </div>
}
