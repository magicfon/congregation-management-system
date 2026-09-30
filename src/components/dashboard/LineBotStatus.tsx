'use client'
import { useEffect, useRef, useState } from 'react'
type Status = { enabled: boolean; pending: number; failed: number; configured: Record<string, boolean> }
export default function LineBotStatus() {
  const [data,setData]=useState<Status|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  const lock=useRef(false)
  async function load(){const res=await fetch('/api/line-bot/notifications',{cache:'no-store'});const value=await res.json();if(!res.ok)throw new Error(value.error||'狀態讀取失敗');setData(value)}
  useEffect(()=>{void load().catch(()=>setMessage('LINE 通知狀態暫時無法讀取。'))},[])
  async function retry(){
    if(lock.current)return
    lock.current=true;setBusy(true);setMessage('')
    try{const res=await fetch('/api/line-bot/notifications',{method:'POST'});const value=await res.json();if(!res.ok)throw new Error(value.error||'重試失敗');setMessage(value.enabled?`LINE 已接受 ${value.accepted} 則，延後 ${value.deferred} 則，失敗 ${value.failed} 則。尚未到重試時間的通知會繼續保留。`:'LINE 尚未啟用。');await load()}
    catch(e){setMessage(e instanceof Error?e.message:'無法確認結果，請稍後重新整理。')}
    finally{setBusy(false);lock.current=false}
  }
  return <section className="rounded-xl border border-white/10 bg-mc-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">LINE Bot 通知 · {data?(data.enabled?'已啟用':'待設定'):'讀取中'}</h2><p className="mt-1 text-xs text-mc-text/50">{data?.enabled?`待處理 ${data.pending} 則 · 失敗 ${data.failed} 則`:'完成官方帳號串接後，傳道安排與交接才會發送通知。'}</p></div><button disabled={busy||!data?.enabled||!data.pending} onClick={()=>void retry()} className="rounded-lg bg-white/5 px-3 py-2 text-sm disabled:opacity-40">{busy?'處理中…':'重試待發通知'}</button></div>{message&&<p role="status" className="mt-3 text-xs text-amber-300">{message}</p>}{data&&!data.enabled&&<details className="mt-3 text-xs text-mc-text/50"><summary className="cursor-pointer">查看串接設定狀態</summary><ul className="mt-2 space-y-1"><li>Channel secret：{data.configured.secret?'已設定':'未設定'}</li><li>Access token：{data.configured.token?'已設定':'未設定'}</li><li>與網站同一 Provider：{data.configured.sameProvider?'已確認':'待確認'}</li><li>通知開關：{data.configured.enabled?'開啟':'關閉'}</li></ul></details>}<p className="mt-2 text-xs text-mc-text/35">LINE 接受訊息不等於已讀；封鎖官方帳號時可能無法收到。</p></section>
}
