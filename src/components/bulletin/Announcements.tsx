'use client'

import { useEffect, useRef, useState } from 'react'
import PdfReader from './PdfReader'
import { MAX_ANNOUNCEMENT_BYTES } from '@/lib/bulletin-announcements'

type Announcement = { id: string; title: string; size: number; createdAt: string }
export default function Announcements({ originalUrl }: { originalUrl: string }) {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const button = 'min-h-11 rounded-lg border border-white/10 px-3 text-sm hover:bg-mc-accent disabled:opacity-40'

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/bulletin/announcements', { cache: 'no-store' })
      if (!response.ok) throw new Error('公告暫時無法讀取')
      const data: Announcement[] = await response.json()
      setItems(data); setOpen(new Set(data[0] ? [data[0].id] : []))
    } catch { setError('公告暫時無法讀取，請重試') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    void load()
    void fetch('/api/me', { cache: 'no-store' }).then(async response => { if (response.ok) setIsAdmin((await response.json()).isAdmin === true) }).catch(() => {})
  }, [])

  async function upload(event: React.FormEvent) {
    event.preventDefault()
    if (!file) return
    setError(''); setNotice('')
    if (file.size > MAX_ANNOUNCEMENT_BYTES) { setError('PDF 不可超過 4 MB'); return }
    setBusy('upload')
    try {
      const params = new URLSearchParams({ title, filename: file.name })
      const response = await fetch(`/api/bulletin/announcements?${params}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '上傳失敗')
      setItems(current => [data, ...current]); setOpen(current => new Set([...current, data.id]))
      setTitle(''); setFile(null); if (input.current) input.current.value = ''
      setNotice('公告已公開')
    } catch (err) { setError(err instanceof Error ? err.message : '上傳失敗，請重試') }
    finally { setBusy('') }
  }

  async function remove(id: string) {
    setBusy(id); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/bulletin/announcements/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('下架失敗，請重試')
      setItems(current => current.filter(item => item.id !== id)); setConfirmId(''); setNotice('公告已下架')
    } catch { setError('下架失敗，請重試') }
    finally { setBusy('') }
  }

  return <div className="space-y-4">
    {isAdmin && <details className="rounded-xl border border-white/10 bg-mc-card p-4">
      <summary className="cursor-pointer text-sm font-semibold">新增公告</summary>
      <form onSubmit={upload} className="mt-4 space-y-3">
        <label className="block text-sm">標題<input type="text" value={title} maxLength={80} disabled={Boolean(busy)} onChange={event => setTitle(event.target.value)} className="mt-2 block min-h-11 w-full rounded-lg border border-white/10 px-3" placeholder="未填寫時使用檔名" /></label>
        <label className="block text-sm">PDF<input ref={input} type="file" accept=".pdf,application/pdf" required disabled={Boolean(busy)} onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-blue-500 file:px-3 file:text-white" /></label>
        <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={!file || Boolean(busy)} className={button}>{busy === 'upload' ? '上傳中…' : '上傳並公開'}</button><p className="text-xs text-mc-text/60">上傳即公開 · 每份最多 4 MB</p></div>
      </form>
    </details>}
    {error && <p role="alert" className="text-sm text-mc-text">{error}<button type="button" className={`${button} ml-3`} disabled={Boolean(busy)} onClick={() => void load()}>重新讀取</button></p>}
    {notice && <p role="status" className="text-sm text-blue-300">{notice}</p>}
    {loading ? <p role="status" className="text-sm text-mc-text/60">正在載入公告…</p> : !items.length && !error ? <p className="text-sm text-mc-text/60">尚無公告</p> : null}
    {items.map(item => <section key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-mc-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <h2 className="min-w-0 flex-1"><button type="button" aria-expanded={open.has(item.id)} aria-controls={`announcement-${item.id}`} className="min-h-11 w-full break-words text-left text-base font-semibold" onClick={() => setOpen(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next })}>{item.title}<span aria-hidden="true" className="ml-2 text-xs text-mc-text/50">{open.has(item.id) ? '▴' : '▾'}</span></button></h2>
        {isAdmin && (confirmId === item.id ? <div className="flex items-center gap-2"><button type="button" className={button} disabled={Boolean(busy)} onClick={() => void remove(item.id)}>{busy === item.id ? '下架中…' : '確認下架'}</button><button type="button" className={button} disabled={Boolean(busy)} onClick={() => setConfirmId('')}>取消</button></div> : <button type="button" className={button} disabled={Boolean(busy)} onClick={() => setConfirmId(item.id)}>下架</button>)}
        {!open.has(item.id) && <time dateTime={item.createdAt} className="w-full pb-2 text-xs text-mc-text/60">{new Date(item.createdAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}</time>}
      </div>
      <div id={`announcement-${item.id}`}>{open.has(item.id) && <PdfReader id={`announcement-${item.id}`} label={item.title} src={`/api/bulletin/announcements/${item.id}`} />}</div>
    </section>)}
    <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs text-mc-text/60 hover:text-blue-300">原 Google 公告頁<span className="sr-only">（另開分頁）</span></a>
  </div>
}
