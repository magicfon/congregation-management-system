'use client'
import { useState } from 'react'
import type { NoticePlanRow } from '@/lib/student-notice'

// 發布後發送 S-89 學生練習通知單：先列出名單，確認才送出（ADR-0090）。
const button = 'min-h-11 rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40'
const groups: [NoticePlanRow['status'], string][] = [['new', '將發送'], ['updated', '將發送更新'], ['cancel', '將通知取消'], ['unreachable', '無法用 LINE 發送，請自行轉交'], ['unchanged', '已發送，沒有變動']]
async function post(body: object) {
  const response = await fetch('/api/midweek/manage', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '操作失敗')
  return data
}
export default function StudentNotices({ weekId }: { weekId: string }) {
  const [rows, setRows] = useState<NoticePlanRow[] | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const pending = rows?.filter(row => row.status === 'new' || row.status === 'updated' || (row.status === 'cancel' && !row.reason)).length || 0
  async function run(action: 'student-notices' | 'student-notices-send') {
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await post({ action, id: weekId })
      setRows(data.rows)
      if (action === 'student-notices-send') setMessage(data.failed ? `已送出 ${data.sent} 則，${data.failed} 則失敗，可再按一次重送` : `已送出 ${data.sent} 則`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-xl border border-white/10 bg-mc-card p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-mc-text/70">學生練習通知單（LINE）</p>
      {rows ? <button className={button} disabled={busy} onClick={() => setRows(null)}>收起</button> : <button className={button} disabled={busy} onClick={() => run('student-notices')}>{busy ? '讀取中…' : '發送學生通知單'}</button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="text-sm text-green-300">{message}</p>}
    {rows && <>
      {!rows.length && <p className="text-sm text-mc-text/60">這週已發布的節目沒有學生。</p>}
      {groups.map(([status, label]) => {
        const list = rows.filter(row => row.status === status)
        return !!list.length && <section key={status} className="space-y-1">
          <h3 className={`text-sm font-semibold ${status === 'unreachable' ? 'text-amber-300' : ''}`}>{label}（{list.length}）</h3>
          <ul className="space-y-1 text-sm">{list.map(row => <li key={row.key}>{row.name}{row.asAssistant ? '（助手）' : ''}｜{row.title}{row.reason ? <span className="text-mc-text/60">｜{row.reason}</span> : null}</li>)}</ul>
        </section>
      })}
      {!!pending && <button className={`${button} bg-blue-600 font-semibold text-white`} disabled={busy} onClick={() => run('student-notices-send')}>{busy ? '發送中…' : `確認發送 ${pending} 則`}</button>}
    </>}
  </div>
}
