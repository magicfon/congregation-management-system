'use client'
import { useEffect, useRef, useState } from 'react'

export default function DispatchSubmitBar({ items, onRemove, onSubmitted, onBusy }: { items: { id: string; label: string }[]; onRemove: (id: string) => void; onSubmitted: () => void; onBusy: (busy: boolean) => void }) {
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [memberId, setMemberId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState(false)
  const lock = useRef(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(false)
    void fetch('/api/members?active=true', { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error()
      const value = await r.json()
      if (!controller.signal.aborted) setMembers(value)
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true) })
    return () => controller.abort()
  }, [retry])
  async function submit() {
    const member = members.find(m => m.id === memberId)
    if (lock.current || !member || !items.length) return
    if (!window.confirm(`分發 ${items.length} 張地圖給「${member.name}」？\n${items.map(i => i.label).join('、')}`)) return
    lock.current = true; setBusy(true); onBusy(true); setMessage('')
    try {
      const res = await fetch('/api/areas/dispatch-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ areaIds: items.map(i => i.id), memberId, note: '' }) })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '分發失敗，請重新整理確認狀態')
      setMessage(`已分發 ${result.assigned} 張給 ${member.name}。${result.sheetSynced ? '' : 'Sheet 尚待同步，請勿重複分發。'}`)
      onSubmitted(); setMemberId('')
    } catch (e) { setMessage(e instanceof Error ? e.message : '連線中斷，請先重新整理確認分發結果。') }
    finally { lock.current = false; setBusy(false); onBusy(false) }
  }
  return <section aria-label="待分發清單" className="space-y-2 bg-mc-card p-3 text-sm">
    <div className="flex justify-between"><strong>待分發 <span className="text-blue-300">{items.length}</span> 張</strong><span className="text-xs text-mc-text/50">選地圖 → 選成員 → 分發</span></div>
    {!!items.length && <div className="flex max-h-20 overflow-y-auto flex-wrap gap-1">{items.map(i => <button key={i.id} disabled={busy} onClick={() => onRemove(i.id)} aria-label={`取消選取${i.label}`} className="rounded bg-white/5 px-2 py-1 text-xs">{i.label} ×</button>)}</div>}
    {loadError ? <button className="text-amber-300" onClick={() => setRetry(v => v + 1)}>成員載入失敗，點此重試</button> : <div className="flex gap-2">
      <select aria-label="分發給成員" value={memberId} disabled={busy} onChange={e => setMemberId(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-mc-accent p-2"><option value="">選擇成員</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <button disabled={busy || !items.length || !memberId} onClick={() => void submit()} className="rounded-lg bg-mc-highlight px-3 py-2 disabled:opacity-40">{busy ? '分發中…' : '確認分發'}</button>
    </div>}
    {message && <p role="status" className="text-xs text-blue-300">{message}</p>}
  </section>
}
