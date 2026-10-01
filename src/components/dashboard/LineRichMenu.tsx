'use client'
import { useEffect, useRef, useState } from 'react'

type Status = { enabled: boolean; installed: boolean; currentId: string | null }
export default function LineRichMenu() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  async function load() {
    setError('')
    try {
      const res = await fetch('/api/line-bot/rich-menu', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '無法讀取選單狀態')
      setStatus(data)
    } catch (e) { setStatus(null); setError(e instanceof Error ? e.message : '讀取失敗') }
  }
  useEffect(() => { void load() }, [])
  async function publish() {
    if (!status?.enabled || lock.current) return
    if (!window.confirm(status.currentId && !status.installed ? 'LINE 目前已有預設選單。要改用下方四格選單嗎？原選單會保留，可由 LINE 後台另行調整。' : '將下方四格選單發布為官方帳號的預設圖文選單？')) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/line-bot/rich-menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedCurrentId: status.currentId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '發布失敗')
      setStatus({ ...data, enabled: true }); setMessage('已發布。請重新開啟 LINE 官方帳號聊天室查看。')
    } catch (e) { setError(e instanceof Error ? e.message : '無法確認發布結果，請重新整理') }
    finally { lock.current = false; setBusy(false) }
  }
  return <details className="mt-4 border-t border-white/10 pt-3">
    <summary className="cursor-pointer text-sm">底部圖文選單 · {status?.installed ? '已發布' : status ? '待發布' : '尚未確認'}</summary>
    <p className="mt-3 text-xs leading-6 text-mc-text/60">前三格直接查詢，公布欄開啟網站。未確認身分的使用者仍需由管理員連結成員。</p>
    {/* A fixed PNG is also the exact image uploaded to LINE. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/line/rich-menu-v1.png" alt="四格圖文選單：我的地圖、本週行程、待交接、公布欄" width={1000} height={674} className="mt-3 w-full max-w-sm rounded-xl border border-white/10" />
    <div className="mt-3 flex flex-wrap gap-2">
      <button disabled={busy || !status?.enabled || status.installed} onClick={() => void publish()} className="min-h-11 rounded-lg bg-mc-highlight px-4 text-sm disabled:opacity-40">{busy ? '發布中…' : status?.installed ? '已發布至 LINE' : '發布至 LINE'}</button>
      <button disabled={busy} onClick={() => void load()} className="min-h-11 rounded-lg bg-white/5 px-4 text-sm disabled:opacity-40">重新整理狀態</button>
    </div>
    {status && !status.enabled && <p className="mt-2 text-xs text-amber-300">請先完成 LINE Bot 設定。</p>}
    {error && <p role="alert" className="mt-2 text-xs text-amber-300">{error}</p>}
    {message && <p role="status" className="mt-2 text-xs text-emerald-300">{message}</p>}
    <p className="mt-2 text-xs text-mc-text/40">已指定個人專用選單的使用者，仍會優先顯示原個人選單。</p>
  </details>
}
