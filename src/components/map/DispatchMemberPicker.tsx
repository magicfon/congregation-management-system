'use client'
import { Check, UserRound } from 'lucide-react'
export type DispatchMember = { id: string; name: string; active?: boolean; showInDispatch?: boolean }
export function visibleDispatchMembers(members: DispatchMember[]) { return members.filter(m => m.active !== false && m.showInDispatch !== false) }
export default function DispatchMemberPicker({ members, value, disabled, onChange }: { members: DispatchMember[]; value: string; disabled: boolean; onChange: (id: string) => void }) {
  const visible = visibleDispatchMembers(members)
  return <div className="min-w-0 w-full space-y-2">
    <div className="flex items-center justify-between text-xs"><span className="text-mc-text/60">派發給</span><a href="/members" className="text-blue-300">設定人選</a></div>
    {visible.length ? <div role="group" aria-label="選擇派發成員" className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain">{visible.map(m => <button key={m.id} type="button" aria-pressed={value === m.id} disabled={disabled} onClick={() => onChange(m.id)} className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm disabled:opacity-40 ${value === m.id ? 'border-blue-400/60 bg-blue-400/15 text-blue-200' : 'border-white/10 bg-white/5 text-mc-text/70 hover:bg-white/10'}`}><UserRound size={14} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 break-words">{m.name}</span>{value === m.id && <Check size={14} className="shrink-0" aria-hidden="true" />}</button>)}</div> : <p className="rounded-lg bg-white/5 p-2 text-xs text-mc-text/50">沒有可顯示的人選，請至成員管理啟用「顯示於派發按鈕」。</p>}
  </div>
}
