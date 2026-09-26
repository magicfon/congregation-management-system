'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { allocationLabel } from '../../lib/allocation'
type Entry = { id: string; status: string; createdAt: string; member: { name: string }; area: { name: string; mapId: string | null; sheetNo: number | null; mapAreaId: number | null } }
const labels: Record<string, string> = { pending: '待審核', approved: '已核准', rejected: '已拒絕', cancelled: '已取消' }
export default function MapRequestsPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [admin, setAdmin] = useState(false)
  const [history, setHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/map-requests', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '無法載入，請確認登入狀態')
      setEntries(data.requests); setAdmin(data.isAdmin)
    } catch (e) { setError(e instanceof Error ? e.message : '載入失敗') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  async function decide(entry: Entry, action: 'approve' | 'reject' | 'cancel') {
    if (lock.current) return
    if (action === 'approve' && !window.confirm(`核准並將「${allocationLabel(entry.area)}」分發給「${entry.member.name}」？`)) return
    lock.current = true; setBusy(true); setMessage('')
    try {
      const res = await fetch('/api/map-requests/' + entry.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '處理失敗')
      setMessage(action === 'approve' ? `已核准並分發。${data.sheetSynced ? '' : '資料庫已完成，Sheet 尚待同步，請勿重複分發。'}` : action === 'reject' ? '已拒絕申請。' : '已取消申請。')
    } catch (e) { setMessage(e instanceof Error ? e.message : '連線中斷，請確認清單狀態後再試') }
    finally { await load(); lock.current = false; setBusy(false) }
  }
  const visible = entries.filter(e => history || e.status === 'pending')
  return <DashboardLayout><div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-3">
    <div className="flex flex-wrap justify-between items-center gap-2"><h1 className="text-xl font-semibold">{admin ? '領圖申請審核' : '我的領圖申請'}</h1><button disabled={busy || loading} onClick={() => void load()} className="rounded border border-white/10 px-3 py-2 text-sm">重新整理</button></div>
    <p className="text-sm text-mc-text/60">待審 {entries.filter(e => e.status === 'pending').length} 張 · {admin ? '逐張核准後立即分發給申請人；已被領取的地圖無法核准。' : '每人待審最多 5 張，核准後可至使用中地圖查看。'}</p>
    <div className="flex flex-wrap gap-4 text-sm"><a href="/map" className="text-blue-300 underline">地圖分配選圖</a><a href="/area-status" className="text-blue-300 underline">區域狀況選圖</a><label><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} className="mr-2" />包含已處理申請</label></div>
    {error && <p role="alert" className="text-red-300">{error}</p>}{message && <p role="status" className="text-blue-300">{message}</p>}
    {loading ? <p role="status">載入中…</p> : <div className="overflow-x-auto rounded-xl border border-white/10 bg-mc-card"><table className="w-full text-sm text-left"><thead className="text-mc-text/60"><tr>{admin && <th className="p-2">申請人</th>}<th className="p-2">地圖</th><th className="p-2">申請時間</th><th className="p-2">狀態</th><th className="p-2">操作</th></tr></thead><tbody>{visible.map(entry => <tr key={entry.id} className="border-t border-white/5">{admin && <td className="p-2">{entry.member.name}</td>}<td className="p-2">{allocationLabel(entry.area)}</td><td className="p-2 text-xs">{new Date(entry.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</td><td className="p-2">{labels[entry.status] || entry.status}</td><td className="p-2">{entry.status === 'pending' && <div className="flex gap-2">{admin ? <><button disabled={busy} onClick={() => void decide(entry, 'approve')} className="rounded bg-mc-highlight px-3 py-1 disabled:opacity-40">核准分發</button><button disabled={busy} onClick={() => void decide(entry, 'reject')} className="rounded border border-white/10 px-3 py-1 disabled:opacity-40">拒絕</button></> : <button disabled={busy} onClick={() => void decide(entry, 'cancel')} className="rounded border border-white/10 px-3 py-1 disabled:opacity-40">取消申請</button>}</div>}</td></tr>)}</tbody></table>{!visible.length && <p className="p-6 text-center text-mc-text/60">目前沒有{history ? '' : '待審'}申請</p>}</div>}
  </div></DashboardLayout>
}
