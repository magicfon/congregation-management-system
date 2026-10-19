'use client'
import { useEffect, useRef, useState } from 'react'
export default function LineNotificationPreference() {
  const [preference,setPreference]=useState<{enabled:boolean;linked:boolean}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const lock=useRef(false)
  useEffect(()=>{let active=true;void fetch('/api/me/line-notifications',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();const data=await r.json();if(active)setPreference(data)}).catch(()=>{if(active)setMessage('通知設定暫時無法讀取，請重新整理。')});return()=>{active=false}},[])
  async function toggle(){
    if(!preference||lock.current)return
    lock.current=true;setBusy(true);setMessage('')
    try{const res=await fetch('/api/me/line-notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!preference.enabled})});const data=await res.json();if(!res.ok)throw new Error(data.error);setPreference({...preference,enabled:data.enabled});setMessage(data.enabled?'已開啟；只接收之後的新通知，不補發先前已取消通知。':'已關閉，尚未發送的通知已取消。')}
    catch(e){setMessage(e instanceof Error?e.message:'無法確認設定，請重新整理。')}
    finally{setBusy(false);lock.current=false}
  }
  return <section data-dashboard-section="notifications" className="dashboard-section"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">LINE 通知</h2><p className="mt-2 max-w-prose text-sm leading-relaxed text-mc-text/70">委派、服務、預排、交接與提交進度提醒；關閉後仍可主動查詢。</p></div><button role="switch" aria-label="LINE 主動通知" aria-checked={preference?.enabled??false} disabled={!preference||busy} onClick={()=>void toggle()} className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm disabled:opacity-40 ${preference?.enabled?'bg-emerald-400/15 text-emerald-300':'bg-white/5 text-mc-text/70'}`}>{busy?'儲存中…':preference?preference.enabled?'開啟':'關閉':'讀取中'}</button></div>{preference&&!preference.linked&&<p className="mt-2 text-xs text-amber-300">尚未綁定 LINE，完成綁定並加入官方帳號後才能收到通知。</p>}{message&&<p role="status" className="mt-2 text-xs text-blue-300">{message}</p>}</section>
}
