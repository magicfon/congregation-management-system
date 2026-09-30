'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import MinistryCanvas from '../../../../components/map/MinistryCanvas'
import type { Stroke } from '../../../../lib/ministry'
type Visit = { id:string; cycleKey:string; publisherId:string; publisherName:string; scheduledDate:string; status:string; strokes:Stroke[]; note:string; submittedAt:string|null }
type Data = { area:{id:string;label:string;managerName:string;active:boolean;revision:number;cycleKey:string;image:{url:string;dims:number[]}|null};viewerId:string;isManager:boolean;members:{id:string;name:string}[];visits:Visit[] }
const labels: Record<string,string>={planned:'預排',active:'進行中',submitted:'已提交',cancelled:'已取消'}
export default function MinistryPage({params}:{params:{id:string}}) {
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  const [strokes,setStrokes]=useState<Stroke[]>([]),[note,setNote]=useState(''),[dirty,setDirty]=useState(false)
  const [review,setReview]=useState<Visit|null>(null)
  const [publisher,setPublisher]=useState(''),[date,setDate]=useState('')
  const [recovery,setRecovery]=useState<{strokes:Stroke[];note:string}|null>(null)
  const lock=useRef(false),mounted=useRef(true)
  const current=data?.visits.filter(v=>v.cycleKey===data.area.cycleKey)||[]
  const mine=current.find(v=>v.status==='active'&&v.publisherId===data?.viewerId)
  const editable=!!mine&&!!data?.area.active
  const backupKey=mine?`ministry-draft:${data?.viewerId}:${mine.id}`:null
  const load=useCallback(async()=>{
    const res=await fetch(`/api/areas/${params.id}/ministry`,{cache:'no-store'})
    const value=await res.json()
    if(!res.ok)throw new Error(value.error||'載入失敗')
    if(!mounted.current)return
    setData(value);setReview(null);setError('');setDirty(false)
    const active=value.visits.find((v:Visit)=>v.cycleKey===value.area.cycleKey&&v.status==='active'&&v.publisherId===value.viewerId)
    setStrokes(active?.strokes||[]);setNote(active?.note||'');setRecovery(null)
    if(active){try{const saved=JSON.parse(localStorage.getItem(`ministry-draft:${value.viewerId}:${active.id}`)||'null');if(saved&&Array.isArray(saved.strokes)&&typeof saved.note==='string'&&JSON.stringify([saved.strokes,saved.note])!==JSON.stringify([active.strokes,active.note]))setRecovery(saved)}catch{}}
  },[params.id])
  useEffect(()=>{mounted.current=true;void load().catch(e=>setError(e.message));return()=>{mounted.current=false}},[load])
  useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
  useEffect(()=>{if(dirty&&backupKey){try{localStorage.setItem(backupKey,JSON.stringify({strokes,note}))}catch{setMessage('裝置無法保留備份，請儲存草稿到雲端。')}}},[dirty,backupKey,strokes,note])
  async function action(action:string,extra:Record<string,unknown>={}){
    if(!data||lock.current)return
    if(dirty&&!['save','submit'].includes(action)){setError('請先儲存本次筆跡與備註，再調整安排。');return}
    if(action==='finish'&&!window.confirm('確認整張地圖已完成並交回？尚未開始的預排將取消。'))return
    if(action==='cancel'&&!window.confirm('取消這次安排？已儲存筆跡仍保留在紀錄中。'))return
    if(action==='submit'&&!window.confirm('提交本次進度並交回給地圖管理者？提交後此筆紀錄不可修改。'))return
    lock.current=true;setBusy(true);setError('');setMessage('')
    let committed=false
    try{
      const res=await fetch(`/api/areas/${params.id}/ministry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,cycleKey:data.area.cycleKey,expectedRevision:data.area.revision,...extra})})
      const result=await res.json();if(!res.ok)throw new Error(result.error||'操作失敗')
      committed=true
      if(['save','submit'].includes(action)&&backupKey){try{localStorage.removeItem(backupKey)}catch{}}
      setDirty(false);setRecovery(null)
      await load()
      setMessage(result.warning||(action==='save'?'草稿已儲存到雲端':action==='submit'?'已提交局部進度，等待管理者交接':action==='finish'?'整張地圖已交回':'安排已更新'))
    }catch(e){setError(`${committed?'操作已儲存，但讀回失敗；請重新載入，勿重複送出。 ':''}${e instanceof Error?e.message:'連線失敗，請重新載入確認'}`)}
    finally{lock.current=false;setBusy(false)}
  }
  async function reload(){if(dirty&&!window.confirm('重新載入會捨棄畫面上未儲存的變更，確定繼續？'))return;try{await load()}catch(e){setError(e instanceof Error?e.message:'載入失敗')}}
  const history=current.filter(v=>v.status==='submitted')
  const old=data?.visits.filter(v=>v.cycleKey!==data.area.cycleKey)||[]
  function records(visits:Visit[]){return visits.map(v=><div key={v.id} className="border-t border-white/10 py-3"><div className="flex flex-wrap justify-between gap-2"><strong>{v.publisherName}</strong><span className="text-xs text-mc-text/50">{v.scheduledDate} · {labels[v.status]}</span></div>{v.submittedAt&&<p className="mt-1 text-xs text-emerald-300">提交：{new Date(v.submittedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})} · {v.strokes.length} 筆標記</p>}{!!v.strokes.length&&<button onClick={()=>setReview(v)} className="mt-2 text-xs text-blue-300 underline">查看這次筆跡</button>}{v.note&&<p className="mt-2 whitespace-pre-wrap break-words text-xs text-mc-text/60">{v.note}</p>}{data?.isManager&&data.area.active&&v.cycleKey===data.area.cycleKey&&['planned','active'].includes(v.status)&&<div className="mt-2 flex gap-2">{v.status==='planned'&&<button disabled={busy||current.some(x=>x.status==='active')} onClick={()=>void action('start',{visitId:v.id})} className="rounded-lg bg-blue-400/15 px-3 py-2 text-xs text-blue-300 disabled:opacity-40">交接給此人</button>}<button disabled={busy} onClick={()=>void action('cancel',{visitId:v.id})} className="rounded-lg bg-white/5 px-3 py-2 text-xs disabled:opacity-40">取消安排</button></div>}</div>)}
  return <DashboardLayout><div className="mx-auto max-w-[1600px] space-y-3 p-4 md:p-8 text-mc-text">
    <header className="flex flex-wrap justify-between gap-2"><div><a href="/dashboard" className="text-xs text-blue-300">← 我的地圖</a><h1 className="mt-1 text-xl font-semibold">{data?.area.label||'傳道進度與交接'}</h1>{data&&<p className="mt-1 text-xs text-mc-text/50">地圖管理者：{data.area.managerName} · {data.area.active?'持有中':'已交回'}</p>}</div><button disabled={busy} onClick={()=>void reload()} className="rounded-lg border border-white/10 px-3 py-2 text-sm">重新載入</button></header>
    {error&&<p role="alert" className="rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}{message&&<p role="status" className="rounded-lg bg-blue-400/10 p-3 text-sm text-blue-300">{message}</p>}
    {!data&&!error&&<p role="status">載入中…</p>}
    {data&&<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="min-w-0 space-y-3">
      {review&&<div className="flex justify-between gap-2 rounded-lg bg-blue-400/10 p-3 text-sm"><span>查看 {review.publisherName} · {review.scheduledDate}（{labels[review.status]}）</span><button onClick={()=>setReview(null)} className="shrink-0 text-blue-300">回到本輪</button></div>}
      {data.area.image?<MinistryCanvas key={`${data.area.id}:${review?.id||mine?.id||'read'}`} image={data.area.image} history={review?[]:history.map(v=>v.strokes)} strokes={review?review.strokes:strokes} editable={editable&&!busy&&!review} onChange={s=>{setStrokes(s);setDirty(true)}}/>:<div className="rounded-xl bg-mc-card p-8 text-sm text-mc-text/50">這張地圖尚無小地圖圖檔，可先用文字記錄進度。</div>}
      {editable&&!review&&<section className="space-y-2 rounded-xl border border-blue-400/30 bg-mc-card p-3"><h2 className="font-semibold">我的本次進度 <span className="text-xs font-normal text-mc-text/50">{dirty?'尚未儲存':'已載入雲端紀錄'}</span></h2>{recovery&&<button disabled={busy} onClick={()=>{setStrokes(recovery.strokes);setNote(recovery.note);setDirty(true);setRecovery(null)}} className="text-sm text-amber-300">恢復此裝置尚未儲存的筆跡與備註</button>}<textarea aria-label="本次傳道進度備註" maxLength={2000} value={note} disabled={busy} onChange={e=>{setNote(e.target.value);setDirty(true)}} placeholder="本次完成範圍、下次接續位置…" className="min-h-20 w-full rounded-lg bg-mc-accent p-3 text-sm"/><div className="flex flex-wrap gap-2"><button disabled={busy||!dirty} onClick={()=>void action('save',{visitId:mine!.id,strokes,note})} className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40">儲存草稿</button><button disabled={busy||(!strokes.length&&!note.trim())} onClick={()=>void action('submit',{visitId:mine!.id,strokes,note})} className="rounded-lg bg-mc-highlight px-3 py-2 text-sm disabled:opacity-40">提交本次進度</button></div><p className="text-xs text-mc-text/40">只提交局部進度，不會把整張地圖標為完成。</p></section>}
      {!editable&&<p className="text-sm text-mc-text/50">{current.some(v=>v.status==='active')?`目前由 ${current.find(v=>v.status==='active')!.publisherName} 進行傳道`:'等待地圖管理者交接下一位傳道者'}</p>}
    </div><aside className="space-y-3">
      {data.isManager&&data.area.active&&<section className="space-y-3 rounded-xl border border-white/10 bg-mc-card p-3"><h2 className="font-semibold">預排傳道</h2><label className="block text-xs text-mc-text/60">日期<input aria-label="預排日期" type="date" value={date} disabled={busy} onChange={e=>setDate(e.target.value)} className="mt-1 block w-full rounded-lg bg-mc-accent p-2 text-sm"/></label><label className="block text-xs text-mc-text/60">傳道者<select aria-label="選擇傳道者" value={publisher} disabled={busy} onChange={e=>setPublisher(e.target.value)} className="mt-1 w-full rounded-lg bg-mc-accent p-2 text-sm"><option value="">選擇成員</option>{data.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><button disabled={busy||!date||!publisher} onClick={()=>void action('plan',{scheduledDate:date,publisherId:publisher})} className="w-full rounded-lg bg-mc-highlight py-2 text-sm disabled:opacity-40">加入預排</button><p className="text-xs text-mc-text/40">預排後按「交接給此人」啟用；同時只能一位。</p></section>}
      <section className="rounded-xl border border-white/10 bg-mc-card p-3"><h2 className="mb-2 font-semibold">本輪安排與回報</h2>{!current.length?<p className="text-sm text-mc-text/50">尚未安排傳道者</p>:records(current)}</section>
      {data.isManager&&data.area.active&&<section className="rounded-xl border border-white/10 bg-mc-card p-3"><button disabled={busy||current.some(v=>v.status==='active')} onClick={()=>void action('finish')} className="w-full rounded-lg border border-emerald-400/30 bg-emerald-400/10 py-2 text-sm text-emerald-300 disabled:opacity-40">確認整張完成並交回</button><p className="mt-2 text-xs text-mc-text/40">交回取消未開始的預排；Google 表單回報仍依原流程填寫。</p></section>}
      {!!old.length&&<details className="rounded-xl bg-mc-card p-3"><summary className="cursor-pointer text-sm">過往領取輪次（{old.length} 筆）</summary>{records(old)}</details>}
    </aside></div>}
  </div></DashboardLayout>
}
