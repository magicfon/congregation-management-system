'use client'
import { useEffect, useRef, useState } from 'react'

type Status = { enabled: boolean; installed: boolean; currentId: string | null; linked?: { brother: number; admin: number } }
const previews = [
  { key: 'sister', label: '姊妹（預設，沒有標籤）', width: 1000, height: 674 },
  { key: 'brother-general', label: '弟兄／管理者：一般頁', width: 1332, height: 900 },
  { key: 'brother-manage', label: '弟兄：管理頁', width: 1332, height: 900 },
  { key: 'admin-manage', label: '管理者：管理頁', width: 1332, height: 900 },
]
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
    if (!window.confirm(status.currentId && !status.installed ? 'LINE 目前已有預設選單。要改用下方選單嗎？姊妹版會成為預設選單，弟兄與管理者另外綁定有「一般｜管理」標籤的選單；原選單會保留。' : '發布下方選單？姊妹版會成為預設選單，弟兄與管理者另外綁定有「一般｜管理」標籤的選單。')) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/line-bot/rich-menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedCurrentId: status.currentId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '發布失敗')
      setStatus({ ...data, enabled: true }); setMessage(`已發布，並綁定 ${data.linked?.brother ?? 0} 位弟兄、${data.linked?.admin ?? 0} 位管理者。請重新開啟 LINE 官方帳號聊天室查看。`)
    } catch (e) { setError(e instanceof Error ? e.message : '無法確認發布結果，請重新整理') }
    finally { lock.current = false; setBusy(false) }
  }
  return <details className="mt-4 border-t border-white/10 pt-3">
    <summary className="cursor-pointer text-sm">底部圖文選單 · {status?.installed ? '已發布' : status ? '待發布' : '尚未確認'}</summary>
    <p className="mt-3 text-xs leading-6 text-mc-text/60">一般頁所有人相同。弟兄與管理者多一個「管理」標籤，內容依權限不同；其他人（含未設性別、未連結）只有一般頁。改權限、改性別、連結 LINE、停用或刪除成員時自動換選單。</p>
    {/* Fixed PNGs are also the exact images uploaded to LINE. */}
    <div className="mt-3 grid gap-3">{previews.map(preview => <figure key={preview.key} className="max-w-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/line/rich-menu-${preview.key}.png`} alt={`${preview.label}圖文選單`} width={preview.width} height={preview.height} className="w-full rounded-xl border border-white/10" />
      <figcaption className="mt-1 text-xs text-mc-text/60">{preview.label}</figcaption>
    </figure>)}</div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button disabled={busy || !status?.enabled || status.installed} onClick={() => void publish()} className="min-h-11 rounded-lg bg-mc-highlight px-4 text-sm disabled:opacity-40">{busy ? '發布中…' : status?.installed ? '已發布至 LINE' : '發布至 LINE'}</button>
      <button disabled={busy} onClick={() => void load()} className="min-h-11 rounded-lg bg-white/5 px-4 text-sm disabled:opacity-40">重新整理狀態</button>
    </div>
    {status && !status.enabled && <p className="mt-2 text-xs text-amber-300">請先完成 LINE Bot 設定。</p>}
    {error && <p role="alert" className="mt-2 text-xs text-amber-300">{error}</p>}
    {message && <p role="status" className="mt-2 text-xs text-emerald-300">{message}</p>}
  </details>
}
