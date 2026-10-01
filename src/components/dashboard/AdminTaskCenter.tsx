'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ClipboardCheck, RefreshCw, Repeat2, UserRoundCheck } from 'lucide-react'
import type { AdminTasks } from '../../lib/admin-tasks'

const categories = [
  { key: 'line', label: 'LINE 待確認', unit: '人', icon: UserRoundCheck },
  { key: 'requests', label: '領圖待審', unit: '張', icon: ClipboardCheck },
  { key: 'handoffs', label: '地圖待交接', unit: '張', icon: Repeat2 },
] as const
type Category = typeof categories[number]['key']

export default function AdminTaskCenter() {
  const [data, setData] = useState<AdminTasks | null>(null)
  const [category, setCategory] = useState<Category>('line')
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const initialized = useRef(false)
  const request = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/tasks', { cache: 'no-store', signal: controller.signal })
      const value: AdminTasks & { error?: string } = await res.json()
      if (!res.ok) throw new Error(value.error || '無法讀取管理員待辦')
      if (controller.signal.aborted) return
      setData(value)
      if (!initialized.current) {
        setCategory(categories.find(c => value[c.key].count > 0)?.key || 'line')
        initialized.current = true
      }
    } catch (e) {
      if (!controller.signal.aborted) { setData(null); setError(e instanceof Error ? e.message : '待辦載入失敗') }
    } finally { if (!controller.signal.aborted) setLoading(false) }
  }, [])
  useEffect(() => {
    void load()
    const focus = () => { void load() }
    window.addEventListener('focus', focus)
    return () => { request.current?.abort(); window.removeEventListener('focus', focus) }
  }, [load])

  const total = data ? data.line.count + data.requests.count + data.handoffs.count : null
  const selected = categories.find(c => c.key === category)!
  const handoffs = data?.handoffs.items.slice(0, expanded ? undefined : 5) || []
  return <section aria-labelledby="admin-tasks-title" className="rounded-2xl border border-blue-300/20 bg-mc-card p-4">
    <header className="flex items-center justify-between gap-3">
      <div><h2 id="admin-tasks-title" className="font-semibold">管理員待辦中心</h2><p className="mt-1 text-xs text-mc-text/50">全會眾{total !== null ? total ? ` · ${total} 項待處理` : ' · 目前沒有待辦事項' : ''}</p></div>
      <button aria-label="重新整理管理員待辦" disabled={loading} onClick={() => void load()} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs text-mc-text/60 hover:bg-white/5 disabled:opacity-40"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/><span className="hidden sm:inline">重新整理</span></button>
    </header>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    {!data && loading && <p role="status" className="py-6 text-sm text-mc-text/50">正在整理待辦…</p>}
    {data && <>
      <div className="mt-4 grid grid-cols-3 gap-2" aria-label="待辦分類">
        {categories.map(({ key, label, unit, icon: Icon }) => <button key={key} aria-pressed={category === key} onClick={() => { setCategory(key); setExpanded(false) }} className={`min-w-0 rounded-xl border p-3 text-left transition-colors ${category === key ? 'border-blue-300/50 bg-blue-400/10' : 'border-white/10 hover:bg-white/5'}`}>
          <Icon size={19} className={data[key].count ? 'text-blue-300' : 'text-mc-text/40'} />
          <span className="mt-2 block"><strong className="text-2xl tabular-nums sm:text-3xl">{data[key].count}</strong><span className="ml-1 text-xs text-mc-text/40">{unit}</span></span>
          <span className="mt-1 block text-xs text-mc-text/70">{label}</span>
        </button>)}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{selected.label}</h3><span role="status" className="text-xs text-mc-text/40">{loading ? '更新中…' : category === 'handoffs' ? '本輪已提交，等待下一步交接' : '依登記時間，最早優先'}</span></div>
      {!data[category].count && <p className="py-5 text-center text-sm text-mc-text/50">此分類目前沒有待辦</p>}
      <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
        {category === 'line' && data.line.items.map((item, index) => <a key={index} href="/members#pending-line" className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-white/[.03] p-3 hover:bg-white/[.07]"><div className="min-w-0"><strong className="block break-words text-sm">{item.name}</strong><p className="mt-1 text-xs text-mc-text/50">{item.date} 登記</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-blue-300">連結成員<ArrowRight size={14}/></span></a>)}
        {category === 'requests' && data.requests.items.map(item => <a key={item.id} href={`/map-requests#request-${encodeURIComponent(item.id)}`} className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-white/[.03] p-3 hover:bg-white/[.07]"><div className="min-w-0"><strong className="block break-words text-sm">{item.label}<span className="ml-2 font-normal text-mc-text/60">{item.name}</span></strong><p className="mt-1 text-xs text-mc-text/50">{item.date} 申請</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-blue-300">審核<ArrowRight size={14}/></span></a>)}
        {category === 'handoffs' && handoffs.map(item => <a key={item.areaId} href={`/map/ministry/${encodeURIComponent(item.areaId)}`} className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-white/[.03] p-3 hover:bg-white/[.07]"><div className="min-w-0"><strong className="block text-sm">{item.label}<span className="ml-2 font-normal text-mc-text/60">管理者：{item.manager}</span></strong><p className="mt-1 text-xs text-mc-text/50">{item.publisher} 已提交 · {item.submittedDate || '日期未記錄'}</p><p className="mt-1 text-xs text-amber-200">{item.next ? `下一位：${item.next.name} · ${item.next.date}` : '尚未安排下一位'}</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-blue-300">交接<ArrowRight size={14}/></span></a>)}
      </div>
      <div className="mt-3 text-xs">
        {category === 'line' && <a href="/members#pending-line" className="inline-flex min-h-11 items-center text-blue-300">前往成員管理{data.line.count > 5 ? ` · 查看全部 ${data.line.count} 人` : ''} →</a>}
        {category === 'requests' && <a href="/map-requests" className="inline-flex min-h-11 items-center text-blue-300">前往申請審核{data.requests.count > 5 ? ` · 查看全部 ${data.requests.count} 張` : ''} →</a>}
        {category === 'handoffs' && data.handoffs.count > 5 && <button onClick={() => setExpanded(v => !v)} className="min-h-11 text-blue-300">{expanded ? '收合清單' : `查看全部 ${data.handoffs.count} 張`}</button>}
      </div>
    </>}
  </section>
}
