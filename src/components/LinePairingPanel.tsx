'use client'

import { useEffect, useState } from 'react'

import SearchableSelect from './SearchableSelect'

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
      setMembers(await res.json()); setSourceId(''); setTargetId('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const source = members.find((m) => m.id === sourceId)
  const target = members.find((m) => m.id === targetId && m.active && !m.lineuid && m.id !== sourceId)
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
      setMessage(`已配對至 ${result.memberName}。${result.notification}。請該 LINE 使用者重新登入。`)
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
        <SearchableSelect label="LINE 帳號（目前配對姓名）" placeholder={loading ? '載入中…' : '輸入 LINE 名稱、成員姓名或 UID'}
          value={sourceId} disabled={loading || saving} onChange={value => { setSourceId(value); setTargetId('') }}
          options={members.filter(member => member.lineuid).map(member => ({ value: member.id, label: `${member.lineDisplayName || '尚未記錄名稱'}（${member.name}）`, description: member.lineuid || '' }))} />
        <SearchableSelect key={sourceId} label="配對到成員" placeholder="輸入尚未綁定的成員姓名" value={targetId} disabled={loading || saving || !sourceId}
          onChange={setTargetId} options={members.filter(member => member.active && !member.lineuid && member.id !== sourceId).map(member => ({ value: member.id, label: member.name, description: member.email }))} />
        {source && <p className="md:col-span-2 break-all text-xs text-mc-text/60">LINE：{source.lineDisplayName || '下次登入後記錄名稱'} · UID：{source.lineuid}</p>}
        <button type="submit" disabled={loading || saving || !source?.lineuid || !target} className="w-fit rounded-lg bg-mc-highlight px-4 py-2 text-sm text-white disabled:opacity-40">{saving ? '配對中…' : '確認配對'}</button>
      </form>
    </details>
  )
}
