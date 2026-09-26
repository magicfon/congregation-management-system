'use client'
import { useEffect, useRef, useState } from 'react'
export default function RequestSubmitBar({ items, onRemove, onSubmitted }: { items: { id: string; label: string }[]; onRemove: (id: string) => void; onSubmitted: () => void }) {
  const [pending, setPending] = useState<string[] | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function load() {
    try {
      const res = await fetch('/api/map-requests', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setPending((await res.json()).pendingAreaIds)
    } catch { setPending(null); setMessage('無法讀取申請額度，請重新整理。') }
  }
  useEffect(() => { void load() }, [])
  async function submit() {
    if (lock.current) return
    lock.current = true; setBusy(true); setMessage('')
    try {
      const res = await fetch('/api/map-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ areaIds: items.map(i => i.id) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '提交失敗')
      setMessage(`已提交 ${data.count} 張申請，請等候管理員審核。`)
      onSubmitted()
    } catch (e) { setMessage(e instanceof Error ? e.message : '連線中斷，請先查看申請清單確認結果。') }
    finally { await load(); lock.current = false; setBusy(false) }
  }
  const duplicate = items.some(i => pending?.includes(i.id))
  const over = pending !== null && pending.length + items.length > 5
  return <section className="rounded-xl border border-blue-400/30 bg-mc-card p-3 space-y-2 text-sm">
    <div className="flex flex-wrap items-center gap-3"><strong>申請領圖 · 已選 {items.length}/5 張</strong><span className="text-mc-text/60">待審 {pending?.length ?? '—'}/5 張</span><a href="/map-requests" className="text-blue-300 underline">查看領圖申請</a>
      <button onClick={() => void submit()} disabled={busy || !items.length || pending === null || duplicate || over} className="rounded-lg bg-mc-highlight px-3 py-2 disabled:opacity-40">{busy ? '提交中…' : '提交申請'}</button></div>
    {!!items.length && <div className="flex flex-wrap gap-2">{items.map(i => <button key={i.id} disabled={busy} onClick={() => onRemove(i.id)} className="rounded border border-white/10 px-2 py-1" aria-label={`取消選取${i.label}`}>{i.label} ×</button>)}</div>}
    <p className="text-xs text-mc-text/60">每人待審合計最多 5 張；核准後才會分發。{duplicate ? '部分地圖已有待審申請，請取消重複選取。' : over ? '選取數量超過剩餘待審額度。' : ''}</p>
    {message && <p role="status" className="text-blue-300">{message}</p>}
  </section>
}
