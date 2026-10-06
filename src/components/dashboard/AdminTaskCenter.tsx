'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import type { AdminTasks } from '../../lib/admin-tasks'

const categories = [
  { key: 'line', label: 'LINE 待確認', unit: '人' },
  { key: 'requests', label: '領圖待審', unit: '張' },
  { key: 'handoffs', label: '待交接', unit: '張' },
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
        setCategory(new URLSearchParams(window.location.search).get('view') === 'handoffs' ? 'handoffs' : categories.find(c => value[c.key].count > 0)?.key || 'line')
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

  const handoffs = data?.handoffs.items.slice(0, expanded ? undefined : 5) || []
  return <section id="handoffs" aria-labelledby="admin-tasks-title" className="rounded-2xl border border-blue-300/20 bg-mc-card p-4">
    <header className="flex items-center justify-between gap-3">
      <h2 id="admin-tasks-title" className="font-semibold">管理待辦</h2>
      <button aria-label="重新整理管理員待辦" title="重新整理" disabled={loading} onClick={() => void load()} className="flex h-11 w-11 items-center justify-center rounded-lg text-mc-text/60 hover:bg-white/5 disabled:opacity-40"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button>
    </header>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    {!data && loading && <p role="status" className="py-6 text-sm text-mc-text/50">正在整理待辦…</p>}
    {data && <>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-white/[.03] p-1" aria-label="待辦分類">
        {categories.map(({ key, label, unit }) => <button key={key} aria-label={`${label} ${data[key].count} ${unit}`} aria-pressed={category === key} onClick={() => { setCategory(key); setExpanded(false) }} className={`flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-md px-2 py-2 transition-colors ${category === key ? 'bg-blue-400/15 text-blue-200' : 'text-mc-text/50 hover:bg-white/5'}`}>
          <span className="text-xs">{label}</span>
          <strong className="text-base tabular-nums">{data[key].count}</strong>
        </button>)}
      </div>
      <span role="status" className="sr-only">{loading ? '更新中…' : ''}</span>
      {!data[category].count && <p className="py-5 text-center text-sm text-mc-text/50">暫無待辦</p>}
      <div className="mt-2 max-h-96 divide-y divide-white/5 overflow-y-auto">
        {category === 'line' && data.line.items.map((item, index) => <a key={index} href="/members#pending-line" className="flex min-h-14 items-center justify-between gap-3 px-1 py-3 hover:bg-white/[.03]"><div className="min-w-0"><strong className="block break-words text-sm">{item.name}</strong><p className="mt-1 text-xs text-mc-text/50">{item.date}</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-blue-300">連結成員<ArrowRight size={14}/></span></a>)}
        {category === 'requests' && data.requests.items.map(item => <a key={item.id} href={`/map-requests#request-${encodeURIComponent(item.id)}`} className="flex min-h-14 items-center justify-between gap-3 px-1 py-3 hover:bg-white/[.03]"><div className="min-w-0"><strong className="block break-words text-sm">{item.label}<span className="ml-2 font-normal text-mc-text/60">{item.name}</span></strong><p className="mt-1 text-xs text-mc-text/50">{item.date}</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-blue-300">審核<ArrowRight size={14}/></span></a>)}
        {category === 'handoffs' && handoffs.map(item => <a key={item.areaId} href={`/map/ministry/${encodeURIComponent(item.areaId)}`} className="flex min-h-14 items-center justify-between gap-3 px-1 py-3 hover:bg-white/[.03]"><div className="min-w-0"><strong className="block text-sm">{item.label}<span className="ml-2 font-normal text-mc-text/60">管理者 {item.manager}</span></strong><p className="mt-1 text-xs text-amber-200">{item.next ? `下一位 ${item.next.name} · ${item.next.date}` : '待安排'}</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-blue-300">交接<ArrowRight size={14}/></span></a>)}
      </div>
      <div className="text-xs">
        {category === 'line' && data.line.count > 5 && <a href="/members#pending-line" className="inline-flex min-h-11 items-center text-blue-300">查看全部（{data.line.count}）</a>}
        {category === 'requests' && data.requests.count > 5 && <a href="/map-requests" className="inline-flex min-h-11 items-center text-blue-300">查看全部（{data.requests.count}）</a>}
        {category === 'handoffs' && data.handoffs.count > 5 && <button onClick={() => setExpanded(v => !v)} className="min-h-11 text-blue-300">{expanded ? '收合清單' : `查看全部 ${data.handoffs.count} 張`}</button>}
      </div>
    </>}
  </section>
}
