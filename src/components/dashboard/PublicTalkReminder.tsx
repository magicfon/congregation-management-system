'use client'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import SearchableSelect from '../SearchableSelect'

type Member = { id: string; name: string; linked: boolean; notifications: boolean }
type State = {
  enabled: boolean; memberIds: string[]; members: Member[]
  lastRun: { week: string; queued: number; at: string } | null
  preview: { text: string | null; monday: string; sunday: string } | { error: string }
}

// 公眾演講週一提醒（ADR-0145）：管理員開關並指定收件人，每週一早上 LINE 私訊本週末講者
export default function PublicTalkReminder() {
  const [data, setData] = useState<State | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [picker, setPicker] = useState('')
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    void fetch('/api/admin/public-talk-reminder', { cache: 'no-store' }).then(async res => { const value = await res.json(); if (!res.ok) throw new Error(value.error); if (active) setData(value) }).catch(() => { if (active) setMessage('提醒設定暫時無法讀取。') })
    return () => { active = false }
  }, [])
  async function save(enabled: boolean, memberIds: string[]) {
    if (lock.current) return
    lock.current = true; setBusy(true); setMessage('')
    try {
      const res = await fetch('/api/admin/public-talk-reminder', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, memberIds }) })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '儲存失敗')
      setData(value); setMessage('已儲存。')
    } catch (e) { setMessage(e instanceof Error ? e.message : '儲存失敗') }
    finally { setBusy(false); lock.current = false }
  }
  const byId = new Map(data?.members.map(m => [m.id, m]) ?? [])
  const selected = data?.memberIds.map(id => byId.get(id)).filter((m): m is Member => !!m) ?? []
  const options = data?.members.filter(m => !data.memberIds.includes(m.id)).map(m => ({ value: m.id, label: m.name, description: !m.linked ? '未連結 LINE，收不到' : !m.notifications ? '已關閉 LINE 通知，收不到' : undefined })) ?? []
  const preview = data?.preview
  return <section className="rounded-xl border border-white/10 bg-mc-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">公眾演講週一提醒</h2><p className="mt-1 text-xs text-mc-text/50">每週一早上 9 點起，LINE 私訊本週末的講題與講者給指定的人。</p></div>
      <button role="switch" aria-label="公眾演講週一提醒" aria-checked={data?.enabled ?? false} disabled={!data || busy} onClick={() => data && void save(!data.enabled, data.memberIds)} className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm disabled:opacity-40 ${data?.enabled ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/5 text-mc-text/70'}`}>{busy ? '儲存中…' : data ? data.enabled ? '開啟' : '關閉' : '讀取中'}</button>
    </div>
    {data && <>
      <div className="mt-3 flex flex-wrap gap-2">
        {selected.length ? selected.map(m => <span key={m.id} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/5 py-1 pl-3 pr-1 text-sm">
          {m.name}{(!m.linked || !m.notifications) && <span className="text-xs text-amber-300">（{m.linked ? '通知已關' : '未連結'}）</span>}
          <button type="button" aria-label={`移除 ${m.name}`} disabled={busy} onClick={() => void save(data.enabled, data.memberIds.filter(id => id !== m.id))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-40"><X size={14} aria-hidden="true" /></button>
        </span>) : <p className="text-xs text-mc-text/50">還沒有指定收提醒的人。</p>}
      </div>
      <div className="mt-3 max-w-sm"><SearchableSelect label="新增收件人" placeholder="輸入姓名搜尋" value={picker} options={options} disabled={busy} onChange={value => { setPicker(''); if (value) void save(data.enabled, [...data.memberIds, value]) }} /></div>
      <details className="mt-3 text-xs text-mc-text/60">
        <summary className="cursor-pointer">預覽本週提醒內容</summary>
        {preview && 'error' in preview ? <p className="mt-2 text-amber-300">{preview.error}</p>
          : preview?.text ? <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white/5 p-3 font-sans text-sm text-mc-text/80">{preview.text}</pre>
          : <p className="mt-2">公眾演講秩序表上找不到本週的安排，這週不會發送。</p>}
      </details>
      {data.lastRun && <p className="mt-2 text-xs text-mc-text/35">上次排程：{data.lastRun.week} 那週，排入 {data.lastRun.queued} 則。</p>}
    </>}
    {message && <p role="status" className="mt-2 text-xs text-blue-300">{message}</p>}
  </section>
}
