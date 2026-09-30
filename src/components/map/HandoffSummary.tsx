'use client'
import { ClipboardCheck, ArrowRight } from 'lucide-react'
type Visit = { id: string; publisherName: string; scheduledDate: string; status: string; submittedAt: string | null; note: string; strokes: unknown[] }

export default function HandoffSummary<T extends Visit>({ visits, active, onReview }: { visits: T[]; active: boolean; onReview: (visit: T) => void }) {
  const last = visits.filter(v=>v.status==='submitted').sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''))[0]
  const current = visits.find(v=>v.status==='active')
  const next = visits.filter(v=>v.status==='planned').sort((a,b)=>a.scheduledDate.localeCompare(b.scheduledDate))[0]
  return <section className="rounded-xl border border-emerald-400/20 bg-mc-card p-3 md:p-4">
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ClipboardCheck size={18} className="text-emerald-300"/>快速交接摘要</h2>
    <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0">{last?<><p className="text-xs text-mc-text/50">上次提交 · {last.publisherName} · {last.submittedAt?new Date(last.submittedAt).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'}):last.scheduledDate}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{last.note||'上次未填寫交接備註，接續位置請向地圖管理者確認。'}</p><button onClick={()=>onReview(last)} className="mt-2 flex items-center gap-1 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">{last.strokes.length?'查看上次完成範圍':'查看上次回報'}<ArrowRight size={14}/></button></>:<p className="text-sm text-mc-text/50">本輪尚無已提交進度，開始前請確認地圖範圍。</p>}</div>
      <div className="space-y-2 rounded-lg bg-white/5 p-3 text-sm">{!active?<p className="text-mc-text/50">地圖已交回</p>:<><div><span className="text-xs text-mc-text/50">目前傳道者</span><p className="mt-1 text-blue-300">{current?`${current.publisherName} · ${current.scheduledDate}`:'等待管理者交接'}</p></div><div className="border-t border-white/10 pt-2"><span className="text-xs text-mc-text/50">下一筆預排</span><p className="mt-1">{next?`${next.publisherName} · ${next.scheduledDate}`:'尚未安排'}</p></div></>}</div>
    </div>
  </section>
}
