'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Identity = { uid: string; displayName: string | null; createdAt: string }
type Member = { id: string; name: string; active: boolean; lineuid?: string | null }

export default function PendingLinePanel({ onLinked }: { onLinked: () => void }) {
  const [pending, setPending] = useState<Identity[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const responses = await Promise.all([fetch('/api/members/pending-line', { cache: 'no-store' }), fetch('/api/members', { cache: 'no-store' })])
      if (responses.some(r => !r.ok)) throw new Error('無法載入待確認名單，請重新整理')
      const [identities, people] = await Promise.all(responses.map(r => r.json()))
      setPending(identities); setMembers(people); setTargets({})
    } catch (e) { setError(e instanceof Error ? e.message : '載入失敗') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function link(identity: Identity) {
    const target = members.find(m => m.id === targets[identity.uid])
    if (!target || lock.current) return
    if (!window.confirm(`將 LINE「${identity.displayName || '未取得顯示名稱'}」連結至「${target.name}」？\nUID：${identity.uid}\n\n此帳號將取得該成員原有權限。請先核對身分。`)) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/members/pending-line', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: identity.uid, targetId: target.id }) })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '連結失敗')
      setMessage(`已連結至 ${result.memberName}。請使用者重新登入，或再次私訊 Bot。`)
      onLinked(); await load()
    } catch (e) { setError(e instanceof Error ? e.message : '無法確認結果，請重新整理') }
    finally { lock.current = false; setBusy(false) }
  }

  return <section className="mb-4 rounded-xl border border-amber-300/20 bg-mc-card p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">待確認 LINE 帳號 <span className="ml-2 rounded-full bg-amber-300/10 px-2 py-1 text-xs text-amber-200">{loading ? '…' : pending.length}</span></h2>
      <button disabled={loading || busy} onClick={() => void load()} className="min-h-11 rounded-lg px-3 text-xs text-mc-text/60 hover:bg-white/5 disabled:opacity-40">重新整理</button>
    </div>
    <p className="mt-1 text-xs text-mc-text/50">確認身分後連結成員，使用者才可使用其權限。若沒有對應成員，請先新增成員再重新整理。</p>
    {error && <p role="alert" className="mt-3 text-sm text-mc-error">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}
    {!loading && !error && !pending.length && <p className="mt-3 text-sm text-mc-text/50">目前沒有待確認帳號</p>}
    <div className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto">
      {pending.map(identity => <div key={identity.uid} className="rounded-lg border border-white/10 p-3 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{identity.displayName || '尚未取得 LINE 顯示名稱'}</p>
          <p className="mt-1 break-all font-mono text-xs text-mc-text/50 select-all">{identity.uid}</p>
          <p className="mt-1 text-xs text-mc-text/40">登記於 {new Date(identity.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
        </div>
        <div className="mt-3 flex gap-2 sm:mt-0">
          <select aria-label={`為 ${identity.displayName || identity.uid} 選擇成員`} disabled={busy || loading} value={targets[identity.uid] || ''} onChange={e => setTargets(t => ({ ...t, [identity.uid]: e.target.value }))} className="min-h-11 min-w-0 flex-1 rounded-lg bg-mc-accent px-3 text-sm sm:w-44">
            <option value="">選擇成員</option>
            {members.filter(m => m.active && !m.lineuid).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button disabled={busy || loading || !targets[identity.uid]} onClick={() => void link(identity)} className="min-h-11 shrink-0 rounded-lg bg-mc-highlight px-4 text-sm disabled:opacity-40">連結</button>
        </div>
      </div>)}
    </div>
  </section>
}
