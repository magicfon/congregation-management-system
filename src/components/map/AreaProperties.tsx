'use client'
import { useRef, useState } from 'react'
type Details = { dispatchEnabled: boolean; sheetNo: number | null; sheetError: string | null; formReports: { row: number; submittedAt: string; memberName: string; completedDate: string }[]; reports: { id: string; content: string; status: string; submittedAt: string; member: { name: string } }[]; _count: { reports: number } }
export default function AreaProperties({ areaId, number, onChange }: { areaId: string; number: number; onChange: (id: string, enabled: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Details | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/areas/${areaId}/properties`, { cache: 'no-store' })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '載入失敗')
      setData(value); onChange(areaId, value.dispatchEnabled)
    } catch (e) { setData(null); setError(e instanceof Error ? e.message : '載入失敗') }
    finally { setLoading(false) }
  }
  async function save() {
    if (!data || lock.current) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/areas/${areaId}/properties`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dispatchEnabled: !data.dispatchEnabled, expectedEnabled: data.dispatchEnabled }) })
      const value = await res.json()
      if (!res.ok) throw new Error(value.error || '儲存失敗')
      setData({ ...data, dispatchEnabled: value.dispatchEnabled }); onChange(areaId, value.dispatchEnabled)
      setMessage(value.dispatchEnabled ? '已開放申請與分發。' : '已暫停申請與分發，目前持有人不變。')
    } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗，請重新載入確認狀態') }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="mt-1 border-t border-white/5 pt-1 text-xs">
    <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); if (!open && !data) void load() }} className="text-blue-300 py-1">{open ? '收合' : '管理'} {number} 號屬性與歷史回報</button>
    {open && <div className="space-y-2 py-2">
      <button disabled={loading || busy} onClick={() => void load()} className="underline text-mc-text/60">重新載入屬性與紀錄</button>
      {loading && <p role="status">載入中…</p>}{error && <p role="alert" className="text-red-300">{error}</p>}{message && <p role="status" className="text-blue-300">{message}</p>}
      {data && <>
        <div className="flex flex-wrap gap-2 items-center"><strong className={data.dispatchEnabled ? 'text-emerald-300' : 'text-amber-300'}>{data.dispatchEnabled ? '允許分發' : '暫停分發'}</strong><button disabled={busy || loading || !!error} onClick={() => void save()} className="rounded border border-white/20 px-2 py-1 disabled:opacity-40">{busy ? '儲存中…' : data.dispatchEnabled ? '暫停分發' : '重新開放'}</button></div>
        <p className="text-mc-text/50">暫停後不能申請、分發或核准，保留目前持有人。</p>
        <details><summary className="cursor-pointer">歷史回報紀錄（表單 {data.sheetError ? '讀取失敗' : data.formReports.length} 筆／系統 {data._count.reports} 筆）</summary>
          <div className="space-y-2 mt-2">
            {data.sheetError && <p className="text-amber-300">{data.sheetError}</p>}
            <h3 className="font-semibold">Google 表單回報</h3>
            {data.sheetNo === null ? <p>尚未對應 Sheet 區域編號</p> : !data.sheetError && !data.formReports.length && <p>沒有表單回報紀錄</p>}
            {data.formReports.map(r => <div key={r.row} className="rounded bg-white/5 p-2"><strong>{r.memberName || '未填姓名'}</strong><p>完成日期：{r.completedDate || '未填'}</p><p className="text-mc-text/50">提交：{r.submittedAt || '未填'}</p></div>)}
            <h3 className="font-semibold">系統內回報{data._count.reports > 100 ? '（最近 100 筆）' : ''}</h3>
            {!data.reports.length && <p>沒有系統內回報紀錄</p>}
            {data.reports.map(r => <div key={r.id} className="rounded bg-white/5 p-2"><strong>{r.member.name}</strong><p className="text-mc-text/50">{new Date(r.submittedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</p><p className="whitespace-pre-wrap break-words">{r.content}</p></div>)}
          </div>
        </details>
      </>}
    </div>}
  </div>
}
