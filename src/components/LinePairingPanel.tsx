'use client'

import { useEffect, useState } from 'react'

type PairingMember = {
  id: string; name: string; email: string; active: boolean
  lineuid: string | null; lineDisplayName: string | null
}

export default function LinePairingPanel({ onPaired }: { onPaired: () => void }) {
  const [members, setMembers] = useState<PairingMember[]>([])
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/members')
      if (!res.ok) throw new Error('無法載入配對名單')
      setMembers(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const source = members.find((m) => m.id === sourceId)
  const target = members.find((m) => m.id === targetId)
  async function pair(e: React.FormEvent) {
    e.preventDefault()
    if (saving || !source?.lineuid || !target) return
    if (!window.confirm(`將 LINE「${source.lineDisplayName || '尚未記錄顯示名稱'}」\nUID：${source.lineuid}\n由「${source.name}」配對到「${target.name}」？\n\n原成員及歷史資料會保留；此 LINE 使用者需重新登入。`)) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/members/line-pairing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId, expectedUid: source.lineuid }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '配對失敗')
      setMessage(`已配對至 ${result.memberName}，請該 LINE 使用者重新登入。`)
      setSourceId(''); setTargetId('')
      onPaired()
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '配對失敗') }
    finally { setSaving(false) }
  }

  return (
    <details className="mb-4 rounded-xl border border-white/10 bg-mc-card p-3">
      <summary className="cursor-pointer text-sm font-medium text-mc-text">LINE 帳號配對</summary>
      <p className="mt-2 text-xs text-mc-text/60">選擇曾登入的 LINE 帳號，再配對到既有成員。只變更登入綁定，原成員及其地圖、回報資料會保留。</p>
      {error && <p role="alert" className="mt-2 text-sm text-mc-error">{error} <button type="button" disabled={saving || loading} onClick={() => void load()} className="underline">重新載入</button></p>}
      {message && <p role="status" className="mt-2 text-sm text-emerald-300">{message}</p>}
      <form onSubmit={pair} className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-mc-text/60">LINE 帳號（目前配對姓名）
          <select required value={sourceId} disabled={loading || saving} onChange={(e) => { setSourceId(e.target.value); setTargetId('') }} className="mt-1 w-full rounded-lg bg-mc-accent p-2 text-sm text-mc-text">
            <option value="">{loading ? '載入中…' : '選擇 LINE 帳號'}</option>
            {members.filter((m) => m.lineuid).map((m) => <option key={m.id} value={m.id}>{m.lineDisplayName || '尚未記錄名稱'}（{m.name}） · {m.lineuid}</option>)}
          </select>
        </label>
        <label className="text-xs text-mc-text/60">配對到成員
          <select required value={targetId} disabled={loading || saving || !sourceId} onChange={(e) => setTargetId(e.target.value)} className="mt-1 w-full rounded-lg bg-mc-accent p-2 text-sm text-mc-text">
            <option value="">選擇尚未綁定的成員</option>
            {members.filter((m) => m.active && !m.lineuid && m.id !== sourceId).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}
          </select>
        </label>
        {source && <p className="md:col-span-2 break-all text-xs text-mc-text/60">LINE：{source.lineDisplayName || '下次登入後記錄名稱'} · UID：{source.lineuid}</p>}
        <button type="submit" disabled={loading || saving || !sourceId || !targetId} className="w-fit rounded-lg bg-mc-highlight px-4 py-2 text-sm text-white disabled:opacity-40">{saving ? '配對中…' : '確認配對'}</button>
      </form>
    </details>
  )
}
