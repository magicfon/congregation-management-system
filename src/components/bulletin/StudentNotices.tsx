'use client'
import { useState } from 'react'
import type { NoticePlanRow } from '@/lib/student-notice'
import { studentNoticeImage } from '@/lib/student-notice-text'

// 發布後發送 S-89 學生練習通知單：先依節目列出學生與助手的狀態，確認才送出（ADR-0090）。
const button = 'min-h-11 rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40'
const badges: Record<NoticePlanRow['status'], [string, string]> = {
  new: ['將發送', 'bg-blue-500/15 text-blue-300'],
  updated: ['將發送更新', 'bg-blue-500/15 text-blue-300'],
  unchanged: ['已發送，未確認', 'bg-slate-500/15 text-mc-text/70'],
  unreachable: ['需自行轉交', 'bg-amber-500/15 text-amber-300'],
  cancel: ['將通知取消', 'bg-red-500/15 text-red-300'],
}
async function post(body: object) {
  const response = await fetch('/api/midweek/manage', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '操作失敗')
  return data
}
function Person({ label, row }: { label: string; row?: NoticePlanRow }) {
  if (!row) return null
  // 學生在 LINE 按「收到」後顯示已確認。
  const [text, color] = row.confirmedAt ? ['已確認', 'bg-green-500/15 text-green-300'] : badges[row.status]
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
    <span className="w-10 shrink-0 text-sm text-mc-text/60">{label}</span>
    <span className="text-base font-medium">{row.name}</span>
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{text}</span>
    {row.reason && <span className="text-xs text-mc-text/60">{row.reason}</span>}
  </div>
}
export default function StudentNotices({ weekId }: { weekId: string }) {
  const [rows, setRows] = useState<NoticePlanRow[] | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const pending = rows?.filter(row => row.status === 'new' || row.status === 'updated' || (row.status === 'cancel' && !row.reason)).length || 0
  const parts = rows ? [...new Set(rows.filter(row => row.status !== 'cancel').map(row => row.itemId))].map(itemId => {
    const list = rows.filter(row => row.itemId === itemId && row.status !== 'cancel')
    return { itemId, title: list[0].title, date: list[0].date, student: list.find(row => !row.asAssistant), assistant: list.find(row => row.asAssistant) }
  }) : []
  const cancels = rows?.filter(row => row.status === 'cancel') || []
  const count = (status: NoticePlanRow['status']) => rows?.filter(row => row.status === status).length || 0
  async function run(action: 'student-notices' | 'student-notices-send') {
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await post({ action, id: weekId })
      setRows(data.rows)
      if (action === 'student-notices-send') setMessage(data.failed ? `已送出 ${data.sent} 則，${data.failed} 則失敗，可再按一次重送` : `已送出 ${data.sent} 則`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  // 手機可直接分享到 LINE；不支援分享時改為下載圖片。
  async function share(part: (typeof parts)[number], row: NoticePlanRow) {
    setBusy(true); setError('')
    try {
      const notice = { name: part.student?.name || '', assistant: part.assistant?.name || '', date: part.date, title: part.title }
      const file = new File([await studentNoticeImage(notice)], `學生練習通知-${part.date}-${row.name}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '學生練習通知' }).catch(e => { if ((e as Error).name !== 'AbortError') throw e })
      } else {
        const url = URL.createObjectURL(file), link = document.createElement('a')
        link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch { setError('無法產生通知單圖片，請稍後再試') } finally { setBusy(false) }
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
      {!!rows.length && <p className="text-sm text-mc-text/70">{[['將發送', count('new') + count('updated')], ['已確認', rows.filter(row => row.confirmedAt).length], ['未確認', count('unchanged') - rows.filter(row => row.confirmedAt).length], ['需自行轉交', count('unreachable')], ['取消', cancels.length]].filter(([, n]) => n).map(([label, n]) => `${label} ${n}`).join('・')}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">{parts.map(part => <li key={part.itemId} className="space-y-2 rounded-lg border border-white/10 p-3">
        <p className="font-semibold">{part.title}</p>
        <Person label="學生" row={part.student} />
        <Person label="助手" row={part.assistant} />
        {[part.student, part.assistant].some(row => row?.status === 'unreachable') && <div className="flex flex-wrap gap-2">{[part.student, part.assistant].filter((row): row is NoticePlanRow => row?.status === 'unreachable').map(row => <button key={row.key} className="min-h-9 rounded-lg border border-white/15 px-3 text-sm" disabled={busy} onClick={() => share(part, row)}>{row.name}的通知單圖片</button>)}</div>}
      </li>)}</ul>
      {!!cancels.length && <section className="space-y-1">
        <h3 className="text-sm font-semibold text-red-300">已換人或取消（{cancels.length}）</h3>
        <ul className="space-y-1 text-sm">{cancels.map(row => <li key={row.key}>{row.name}{row.asAssistant ? '（助手）' : ''}｜{row.title}{row.reason ? <span className="text-mc-text/60">｜{row.reason}</span> : null}</li>)}</ul>
      </section>}
      {!!pending && <button className={`${button} bg-blue-600 font-semibold text-white`} disabled={busy} onClick={() => run('student-notices-send')}>{busy ? '發送中…' : `確認發送 ${pending} 則`}</button>}
    </>}
  </div>
}
