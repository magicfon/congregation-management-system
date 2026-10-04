'use client'

import { useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { checkSync, syncCounts, type SyncResult } from '../../lib/sync-check'

const names = { completionDatesUpdated: '完成日期更新', imported: '回報匯入', sheetEdits: 'Sheet 編輯匯入', conflicts: '衝突', pushedBack: '推回 Sheet' }

export default function SyncCheck() {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<SyncResult[]>([])
  const [status, setStatus] = useState('')
  const [problem, setProblem] = useState(false)

  async function start() {
    if (lock.current) return
    lock.current = true
    setBusy(true); setResults([]); setProblem(false); setStatus('正在執行第 1 次同步…')
    let count = 0
    try {
      const passed = await checkSync(async () => {
        const response = await fetch('/api/cron/sync-sheet', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
        if (response.status === 401 || response.status === 403) throw new Error('請以管理員身分重新登入後再試。')
        const value = await response.json()
        if (!response.ok && typeof value.ok !== 'boolean') throw new Error('伺服器暫時無法完成檢查，請稍後確認同步狀態。')
        return { ...value, ok: response.ok && value.ok }
      }, result => {
        count++
        setResults(previous => [...previous, result])
        if (count === 1) setStatus('第 1 次完成，正在執行第 2 次同步…')
      })
      setProblem(!passed)
      setStatus(passed ? '檢查通過：第二次同步無變更、無錯誤。' : '第二次仍有變更，尚未通過零變更檢查；可能有新回報或同時編輯，請查看結果。')
    } catch (error) {
      setProblem(true)
      setStatus(error instanceof TypeError || error instanceof SyntaxError ? '連線中斷或回應異常，部分同步可能已完成。請稍後確認，勿連續重複點擊。' : error instanceof Error ? error.message : '無法確認同步結果，請稍後檢查。')
    } finally { lock.current = false; setBusy(false) }
  }

  return <section className="rounded-xl border border-white/10 bg-mc-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">Sheet 同步檢查</h2><p className="mt-1 text-xs text-mc-text/50">同步資料並再檢查一次，第一次可能匯入待處理變更。</p></div>
      <button disabled={busy} onClick={() => void start()} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={16} className={busy ? 'animate-spin' : ''}/>{busy ? '檢查中…' : '同步並檢查'}</button>
    </div>
    {status && <p role={problem ? 'alert' : 'status'} className={`mt-3 text-sm ${problem ? 'text-amber-300' : busy ? 'text-mc-text/60' : 'text-emerald-300'}`}>{status}</p>}
    {!!results.length && <details className="mt-3 text-xs"><summary className="cursor-pointer text-mc-text/60">查看同步結果（{results.length} 次）</summary><div className="mt-2 grid gap-3 sm:grid-cols-2">{results.map((result, index) => <div key={index} className="rounded-lg bg-white/5 p-3"><h3 className="mb-2 font-semibold">第 {index + 1} 次</h3><dl className="space-y-1">{syncCounts.map(key => <div key={key} className="flex justify-between gap-3"><dt className="text-mc-text/60">{names[key]}</dt><dd className="tabular-nums">{result[key]}</dd></div>)}</dl>{result.serviceRoster && <p className="mt-2 text-mc-text/60">服務安排：匯入 {result.serviceRoster.pulled} 週／寫回 {result.serviceRoster.pushed} 列／待確認 {result.serviceRoster.conflicts.length} 週</p>}{[result.error, ...result.errors].filter(Boolean).map((error, i) => <p key={i} className="mt-2 break-words text-amber-300">{error}</p>)}</div>)}</div></details>}
  </section>
}
