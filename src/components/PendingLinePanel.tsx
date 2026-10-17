'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import SearchableSelect from './SearchableSelect'

type Identity = { uid: string; displayName: string | null; createdAt: string }
type Member = { id: string; name: string; active: boolean; email: string; lineuid?: string | null }

export default function PendingLinePanel({ onLinked }: { onLinked: () => void }) {
  const [pending, setPending] = useState<Identity[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [queries, setQueries] = useState<Record<string, string>>({})
  const [roles, setRoles] = useState<Record<string, 'admin' | 'publisher'>>({})
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
      setPending(identities); setMembers(people); setTargets({}); setQueries({})
    } catch (e) { setError(e instanceof Error ? e.message : '載入失敗') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (window.location.hash === '#pending-line') document.getElementById('pending-line')?.scrollIntoView({ block: 'start' })
  }, [])

  async function link(identity: Identity) {
    const target = members.find(m => m.id === targets[identity.uid] && m.active && !m.lineuid)
    const create = targets[identity.uid] === '__new__'
    const name = (names[identity.uid] ?? identity.displayName ?? '').trim()
    const role = roles[identity.uid] ?? 'publisher'
    if ((!create && !target) || (create && !name) || lock.current) return
    if (!window.confirm(create
      ? `建立「${name}」並連結 LINE「${identity.displayName || identity.uid}」？\n權限：${role === 'admin' ? '管理員' : '一般傳道員'}`
      : `將 LINE「${identity.displayName || identity.uid}」連結至「${target!.name}」？`)) return

    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/members/pending-line', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(create ? { action: 'create', uid: identity.uid, name, role } : { uid: identity.uid, targetId: target!.id }) })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '連結失敗')
      setMessage(`已連結至 ${result.memberName}。${result.notification}。請使用者重新登入，或再次私訊 Bot。`)
      onLinked(); await load()
    } catch (e) { setError(e instanceof Error ? e.message : '無法確認結果，請重新整理') }
    finally { lock.current = false; setBusy(false) }
  }

  return <section id="pending-line" className="mb-4 scroll-mt-20 rounded-xl border border-amber-300/20 bg-mc-card p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">待確認 LINE 帳號 <span className="ml-2 rounded-full bg-amber-300/10 px-2 py-1 text-xs text-amber-200">{loading ? '…' : pending.length}</span></h2>
      <button disabled={loading || busy} onClick={() => void load()} className="min-h-11 rounded-lg px-3 text-xs text-mc-text/60 hover:bg-white/5 disabled:opacity-40">重新整理</button>
    </div>
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
        <div className="mt-3 flex max-w-full flex-wrap gap-2 sm:mt-0 sm:w-80">
          {targets[identity.uid] !== '__new__' && <SearchableSelect label={`為 ${identity.displayName || identity.uid} 選擇成員`} placeholder="輸入成員姓名搜尋" disabled={busy || loading}
            value={targets[identity.uid] || ''} onChange={value => { setTargets(old => ({ ...old, [identity.uid]: value })); if (value) setQueries(old => ({ ...old, [identity.uid]: '' })) }}
            onQueryChange={query => setQueries(old => ({ ...old, [identity.uid]: query }))}
            options={members.filter(member => member.active && !member.lineuid).map(member => ({ value: member.id, label: member.name, description: member.email }))} />}
          <button disabled={busy || loading || !targets[identity.uid] || (targets[identity.uid] === '__new__' && !(names[identity.uid] ?? identity.displayName ?? '').trim())} onClick={() => void link(identity)} className="min-h-11 shrink-0 self-start rounded-lg bg-mc-highlight px-4 text-sm disabled:opacity-40">{targets[identity.uid] === '__new__' ? '建立並連結' : '連結'}</button>
          <button type="button" disabled={busy || loading} onClick={() => {
            if (targets[identity.uid] === '__new__') { setTargets(old => ({ ...old, [identity.uid]: '' })); setQueries(old => ({ ...old, [identity.uid]: '' })) }
            else {
              setNames(old => ({ ...old, [identity.uid]: queries[identity.uid]?.trim() || identity.displayName || '' }))
              setTargets(old => ({ ...old, [identity.uid]: '__new__' }))
            }
          }} className="min-h-11 w-full rounded-lg border border-white/10 px-3 text-sm text-blue-300 disabled:opacity-40">{targets[identity.uid] === '__new__' ? '改選既有成員' : '＋ 建立新成員'}</button>
          {targets[identity.uid] === '__new__' && <div className="flex w-full gap-2">
            <input aria-label="新成員姓名" placeholder="姓名" maxLength={100} disabled={busy || loading} value={names[identity.uid] ?? identity.displayName ?? ''} onChange={e => setNames(old => ({ ...old, [identity.uid]: e.target.value }))} className="min-h-11 min-w-0 flex-1 rounded-lg bg-mc-accent px-3 text-sm" />
            <select aria-label="新成員權限" disabled={busy || loading} value={roles[identity.uid] ?? 'publisher'} onChange={e => setRoles(old => ({ ...old, [identity.uid]: e.target.value as 'admin' | 'publisher' }))} className="min-h-11 rounded-lg bg-mc-accent px-2 text-sm">
              <option value="publisher">一般傳道員</option><option value="admin">管理員</option>
            </select>
          </div>}
        </div>
      </div>)}
    </div>
  </section>
}
