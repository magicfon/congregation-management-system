'use client'
import { useState } from 'react'
import { defaultPalette, versionColor, type MeetingVersion, type Palette } from '@/lib/midweek-versions'

export function versionLabel(number: number, date?: string | null) {
  return `第${number}版・${date ? `${Number(date.slice(5,7))}/${Number(date.slice(8,10))}更新` : '日期未記錄'}`
}
export default function VersionDetails({ versions, current, dates, palette, management, busy, onPalette, onDate }: {
  versions: MeetingVersion[]; current?: MeetingVersion; dates: Record<string, string | null>; palette: Palette; management: boolean; busy: boolean
  onPalette: (palette: Palette) => Promise<boolean>; onDate: (number: number, date: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState<Palette | null>(null)
  const [extra, setExtra] = useState(7)
  const numbers = [...new Set([...(current ? [current.number, ...Object.values(current.marks)] : []), ...versions.map(v => v.number)])].sort((a,b)=>a-b)
  const colorNumbers = [...new Set([...numbers.filter(n=>n>1), ...Object.keys(defaultPalette).map(Number), ...Object.keys(editing || palette).map(Number)])].sort((a,b)=>a-b)
  return <details className={management ? 'text-sm' : 'relative shrink-0 text-sm'}><summary aria-label={management ? '版次與顏色設定' : '版次與顏色說明'} className="flex min-h-11 cursor-pointer items-center py-2 text-mc-text/70">{management ? '版次與顏色設定' : '⋯'}</summary>
    <div className={management ? '' : 'absolute right-0 z-30 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-white/15 bg-mc-card p-3 shadow-xl'}>
    <div className="flex flex-wrap gap-3 py-2">{numbers.map(number => {
      const snapshot = versions.find(v=>v.number===number)
      const date = snapshot?.date || dates[number]
      return <div key={number} className="flex flex-wrap items-center gap-2"><span className="h-4 w-4 rounded border border-gray-400" style={{background:versionColor(number,palette)}} /><span>{versionLabel(number,date)}{!snapshot && '（無舊稿）'}</span>
        {management && !snapshot?.date && <label className="text-xs">補填日期<input aria-label={`第${number}版更新日期`} type="date" defaultValue={date || ''} disabled={busy} className="ml-2 min-h-11 rounded border bg-mc-card p-2" onBlur={e=>{if(e.target.value && e.target.value!==date) void onDate(number,e.target.value)}} /></label>}
      </div>
    })}</div>
    {management && <details className="py-2"><summary className="cursor-pointer py-2">全站統一配色</summary><p className="mb-3 text-mc-text/60">儲存後套用所有週次及歷史版本。</p><div className="flex flex-wrap gap-3">{colorNumbers.map(number=><label key={number} className="flex items-center gap-2">第{number}版<input aria-label={`第${number}版顏色`} type="color" disabled={busy} value={versionColor(number, editing || palette)} onChange={e=>setEditing({...palette,...editing,[number]:e.target.value})} /></label>)}</div><button disabled={busy || !editing} className="mt-3 min-h-11 rounded border px-3 disabled:opacity-40" onClick={async()=>{if(editing && await onPalette(editing)) setEditing(null)}}>儲存統一配色</button></details>}
    {management && <label className="mt-2 flex items-center gap-2">設定其他版次<input aria-label="新增配色版次" type="number" min={2} max={10000} className="min-h-11 w-20 rounded border bg-mc-card px-2" value={extra} onChange={e=>setExtra(Number(e.target.value))} /><button className="min-h-11 rounded border px-3" disabled={busy || !Number.isInteger(extra) || extra<2 || extra>10000} onClick={()=>setEditing({...palette,...editing,[extra]:versionColor(extra,editing || palette)!})}>加入配色</button></label>}
    </div>
  </details>
}
