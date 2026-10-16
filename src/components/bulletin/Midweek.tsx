'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { addDays, currentAndFutureWeeks, newMeeting, nextMidweekCheck, sectionNames, type Meeting, type MeetingItem, type MeetingRecord, type Section, type SourceWeek } from '@/lib/midweek'
import MeetingSheet from './MeetingSheet'
import VersionDetails, { versionLabel } from './VersionDetails'
import { previewVersion, type MeetingVersion, type Palette } from '@/lib/midweek-versions'

type Week = { id: string; date: string; week?: string; reading: string; publishedAt?: string | null; changedSource?: boolean }
type Sync = { month: string; remaining: number; done: number; imported: number; completedAt: string | null; errors: { url: string; error: string }[]; busy?: boolean }
const field = 'w-full min-w-0 min-h-11 rounded-lg border border-white/15 bg-mc-card px-3 py-2 text-base font-normal text-mc-text'
const button = 'min-h-11 rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40'
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...options })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '讀取失敗')
  return data
}
export default function Midweek({ management = false }: { management?: boolean }) {
  const [weeks, setWeeks] = useState<Week[]>([]), [id, setId] = useState('')
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [source, setSource] = useState<SourceWeek | null>(null), [record, setRecord] = useState<MeetingRecord | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null), [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [syncing, setSyncing] = useState(false)
  const [sync, setSync] = useState<Sync | null>(null), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [preview, setPreview] = useState(false), [isAdmin, setIsAdmin] = useState(management)
  const [selected, setSelected] = useState<number | null>(null)
  const [publicVersions, setPublicVersions] = useState<MeetingVersion[]>([])
  const [versionNumber, setVersionNumber] = useState(0)
  const [palette, setPalette] = useState<Palette>({})
  const versions = management ? record?.versions || [] : publicVersions
  const dates = record?.versionDates || {}
  const historical = versions.find(v=>v.number===versionNumber)
  const shown = historical || (management && meeting ? previewVersion(meeting, versions.at(-1)) : versions.at(-1))
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (selected !== null && dialog.current && !dialog.current.open) dialog.current.showModal()
    if (selected === null) dialog.current?.close()
  }, [selected])
  const alive = useRef(true)
  const endpoint = management ? '/api/midweek/manage' : '/api/midweek'
  useEffect(() => {
    let active = true
    const refreshColors = () => { if (document.visibilityState === 'visible') api('/api/midweek?palette=1').then(data=>{if(active)setPalette(data.palette)}).catch(()=>{}) }
    window.addEventListener('focus', refreshColors)
    const timer = window.setInterval(refreshColors, 30000)
    return () => { active=false; window.removeEventListener('focus',refreshColors); window.clearInterval(timer) }
  }, [])
  async function refresh() {
    const data = await api(endpoint)
    if (!alive.current) return
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const choices: Week[] = management ? currentAndFutureWeeks(data.weeks, today) : [...data.weeks].sort((a: Week, b: Week) => a.date.localeCompare(b.date))
    setWeeks(choices); if (management) { setMembers(data.members); setSync(data.sync) }
    setId(current => {
      if (current && choices.some(w => w.id === current)) return current
      if (management) return choices[0]?.id || ''
      return choices.find(w => w.date >= addDays(today, -3))?.id || choices.at(-1)?.id || ''
    })
  }
  useEffect(() => {
    alive.current = true
    refresh().catch(e => setError(e.message)).finally(() => setLoading(false))
    if (!management) api('/api/me').then(data => setIsAdmin(data.role === 'admin' || data.user?.role === 'admin')).catch(() => {})
    return () => { alive.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])
  useEffect(() => {
    if (!id) { setMeeting(null); return }
    const controller = new AbortController()
    setSelected(null); setVersionNumber(0); setPublicVersions([]); setLoading(true); setMeeting(null); setSource(null); setRecord(null); setError(''); setMessage('')
    api(`${endpoint}?id=${id}`, { signal: controller.signal }).then(data => {
      if (management) { setSource(data.source); setRecord(data.record); setMeeting(data.record?.draft || newMeeting(data.source)) }
      else { setMeeting(data.meeting); setPublicVersions(data.versions || []) }
      setPalette(data.palette || {})
      setDirty(false)
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, endpoint, management])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const change = (patch: Partial<Meeting>) => { setMeeting(current => current && { ...current, ...patch }); setDirty(true); setMessage('') }
  const itemChange = (index: number, patch: Partial<MeetingItem>) => change({ items: meeting!.items.map((r, i) => i === index ? { ...r, ...patch } : r) })
  async function versionSetting(action: 'palette' | 'version-date', value: unknown) {
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await api(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, action, revision:record?.revision || 0, ...(action==='palette' ? {palette:value} : {meeting:value})}) })
      if(action==='palette') setPalette(data.palette)
      else setRecord(data.record)
      setMessage('設定已儲存')
      return true
    } catch(e) { setError((e as Error).message); return false } finally { setBusy(false) }
  }
  async function save(action: string) {
    if (!meeting || busy) return
    if (action === 'restore' && (!historical || !confirm(`將第${historical.number}版退回為草稿？目前草稿（含尚未儲存修改）會被取代，公開內容維持不變；確認後可再發布新版。`))) return
    if (action === 'reset' && !confirm('以最新手冊重新建立草稿？目前草稿的人員與修改將被清除，已發布版本會保留。')) return
    if (action === 'unpublish' && !confirm('下架這週節目？公開公布欄將不再顯示。')) return
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, revision: record?.revision || 0, meeting: action === 'restore' ? { number: historical!.number } : meeting }) })
      setRecord(data.record); setSource(data.source)
      if (action !== 'unpublish') { setMeeting(data.record.draft); setDirty(false) }
      if (action === 'restore') { setVersionNumber(0); setSelected(null); setPreview(true) }
      setMessage(action === 'restore' ? `已將第${historical!.number}版退回為草稿，確認後請按「發布新版」` : action === 'publish' ? '已發布到公布欄' : action === 'unpublish' ? '已下架' : '草稿已儲存')
      await refresh()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function runSync() {
    setSyncing(true); setError('')
    try {
      let status: Sync
      do {
        const data = await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) })
        status = data.sync; if (!alive.current) break
        setSync(status)
        await refresh()
      } while (status.remaining > 0 && !status.busy && alive.current)
    } catch (e) { setError((e as Error).message) } finally { if (alive.current) setSyncing(false) }
  }
  const move = (index: number, direction: number) => {
    const items = [...meeting!.items], target = index + direction
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]; change({ items })
  }
  const weekIndex = weeks.findIndex(week => week.id === id)
  const switchWeek = (nextId?: string) => {
    if (!nextId || nextId === id || busy || loading) return
    if (!dirty || confirm('尚有未儲存修改，確定切換週次？')) setId(nextId)
  }
  const weekButton = 'flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-mc-highlight bg-mc-highlight/30 px-5 py-3 text-base font-semibold text-mc-text transition-colors hover:bg-mc-highlight/35 active:bg-mc-highlight/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mc-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-mc-bg disabled:cursor-not-allowed disabled:border-mc-text/10 disabled:bg-mc-accent/40 disabled:text-mc-text/35'
  const readerButton = 'flex h-11 w-7 sm:w-11 shrink-0 items-center justify-center rounded-lg hover:bg-mc-accent disabled:opacity-30'
  return <div className={management ? 'space-y-4' : 'space-y-2'}>
    <div className={management ? 'flex flex-wrap items-center gap-3' : 'flex items-center gap-1 sm:gap-2'}>
      {!management && <Link href="/bulletin" aria-label="回公布欄" title="回公布欄" className={readerButton}><ArrowLeft className="h-5 w-5" /></Link>}
      <select aria-label="選擇週次" className={management ? `${field} basis-full sm:!w-auto sm:basis-auto sm:flex-1` : `${field} !w-0 flex-1 !px-2 text-sm`} value={id} disabled={busy || loading} onChange={e => switchWeek(e.target.value)}>
        {!weeks.length && <option value="">{management ? '尚無本週或未來節目' : '尚未發布節目'}</option>}
        {weeks.map(w => <option key={w.id} value={w.id}>{management ? `${w.date}　${w.reading}${w.publishedAt ? '（已發布）' : '（草稿）'}` : w.date.slice(5).replace('-', '/')}</option>)}
      </select>
      {management && !!versions.length && <select aria-label="選擇版次" className="min-h-11 min-w-0 max-w-[38%] rounded-lg border border-white/15 bg-mc-card px-1 text-xs sm:text-sm" value={versionNumber} disabled={busy || loading} onChange={e=>{setVersionNumber(Number(e.target.value));setSelected(null)}}>
        <option value={0}>編輯草稿</option>
        {[...versions].reverse().map(v=><option key={v.number} value={v.number}>{versionLabel(v.number,v.date || dates[v.number])}</option>)}
      </select>}
      {management ? <><button className={button} disabled={syncing || busy} onClick={runSync}>{syncing ? '匯入中…' : '檢查／匯入手冊'}</button><Link className={button} href="/bulletin/midweek-meeting">公開頁</Link></> : isAdmin && <Link aria-label="編排節目" title="編排節目" className={readerButton} href="/midweek/manage"><Pencil className="h-4 w-4" /></Link>}
    </div>
    <nav aria-label="切換週次" className="grid grid-cols-2 gap-3">
      <button aria-label="前一週" className={weekButton} disabled={busy || loading || weekIndex <= 0} onClick={() => switchWeek(weeks[weekIndex - 1]?.id)}><ChevronLeft aria-hidden="true" className="h-6 w-6 shrink-0" />前一週</button>
      <button aria-label="下一週" className={weekButton} disabled={busy || loading || weekIndex < 0 || weekIndex >= weeks.length - 1} onClick={() => switchWeek(weeks[weekIndex + 1]?.id)}>下一週<ChevronRight aria-hidden="true" className="h-6 w-6 shrink-0" /></button>
    </nav>
    {management && !loading && <p className="text-sm text-mc-text/70">預計下次檢查新手冊：{nextMidweekCheck(sync).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}（台北時間）</p>}
    {management && !!sync?.errors.length && <details className="text-sm text-amber-300"><summary className="cursor-pointer py-2">部分來源待重試，將於下次排程繼續檢查</summary>{sync.errors.map(e => <p key={e.url}><a className="underline" href={e.url} target="_blank" rel="noreferrer">來源頁面</a>：{e.error}</p>)}</details>}
    {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-red-300">{error}</p>}
    {message && <p role="status" className="text-green-300">{message}</p>}
    {loading && <p role="status">載入中…</p>}
    {!loading && !meeting && !error && <p className="py-8 text-mc-text/60">{management ? '目前沒有本週或未來的節目，請按「檢查／匯入手冊」取得新週次。' : '目前沒有已發布的週中聚會節目。'}</p>}
    {meeting && <>
      {management && <VersionDetails key={id} versions={versions} current={historical || versions.at(-1)} dates={dates} palette={palette} management={management} busy={busy} onPalette={value=>versionSetting('palette',value)} onDate={(number,date)=>versionSetting('version-date',{number,date})} />}
      {management && historical && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-mc-text/60">正在查看第{historical.number}版</p><button className={button} disabled={busy || loading} onClick={() => save('restore')}>退回此版為草稿</button></div>}
      {management && !historical && shown && <p className="text-sm text-mc-text/60">草稿預覽 · 第{shown.number}版{dirty ? '（尚未發布）' : ''}</p>}
      {management && !historical && <>
        <div className="flex flex-wrap gap-2"><button className={button} onClick={() => setPreview(!preview)}>{preview ? '回到編輯' : '預覽版面'}</button><button className={button} disabled={busy} onClick={() => save('save')}>儲存草稿{dirty ? '＊' : ''}</button><button className={`${button} bg-blue-600 text-white`} disabled={busy} onClick={() => save('publish')}>發布新版</button>{record?.published && <button className={button} disabled={busy} onClick={() => save('unpublish')}>下架</button>}</div>
        {source && record && source.hash !== record.sourceHash && <p className="text-amber-300">官方手冊有新版，現有安排已保留。可查看來源後自行調整，或重新建立草稿。</p>}
        {source && <details className="text-sm"><summary className="cursor-pointer py-2">手冊來源與重建草稿</summary><div className="flex flex-wrap items-center gap-3"><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.week} 週次手冊</a><button className={button} disabled={busy} onClick={() => save('reset')}>從最新手冊重建草稿</button></div></details>}
        {!preview && <dialog ref={dialog} aria-label="編排設定" onCancel={() => setSelected(null)} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-mc-bg p-5 text-mc-text shadow-2xl backdrop:bg-black/60 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{selected === -1 ? '日期與節目表設定' : '節目設定'}</h2><button className={button} onClick={() => setSelected(null)}>完成</button></div><fieldset disabled={busy} className="space-y-4 [&_label]:flex [&_label]:flex-col [&_label]:gap-2 [&_label]:text-sm [&_label]:font-medium">
          {selected === -1 && <div className="grid gap-3 sm:grid-cols-2"><label>聚會日期<input type="date" className={field} value={meeting.date} onChange={e => change({ date: e.target.value })} /></label><label>開始時間<input type="time" className={field} value={meeting.start} onChange={e => change({ start: e.target.value })} /></label><label>更新標示<input placeholder="例如：10/9 更新" className={field} value={meeting.note} onChange={e => change({ note: e.target.value })} /></label></div>}
          {meeting.items.map((item, index) => selected === index && <div key={item.id}><div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">節目名稱<input className={field} value={item.title} onChange={e => itemChange(index, { title: e.target.value })} /></label>
            <label>分鐘<input type="number" min="0" max="180" className={field} value={item.minutes} onChange={e => itemChange(index, { minutes: Number(e.target.value) })} /></label>
            <label>講評／轉場分鐘<input type="number" min="0" max="30" className={field} value={item.counsel} onChange={e => itemChange(index, { counsel: Number(e.target.value) })} /></label>
            <label>負責人／學生<input list="meeting-members" className={field} value={item.person} onChange={e => itemChange(index, { person: e.target.value })} /></label><label>助手<input list="meeting-members" className={field} value={item.assistant} onChange={e => itemChange(index, { assistant: e.target.value })} /></label>
            <label>職務標籤<input className={field} value={item.role} onChange={e => itemChange(index, { role: e.target.value })} /></label>
            <label>段落<select className={field} value={item.section} onChange={e => itemChange(index, { section: e.target.value as Section })}>{Object.entries(sectionNames).map(([key, name]) => <option key={key} value={key}>{name || '開場'}</option>)}</select></label>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><button className={button} disabled={index === 0} onClick={() => { move(index, -1); setSelected(index - 1) }}>上移</button><button className={button} disabled={index === meeting.items.length - 1} onClick={() => { move(index, 1); setSelected(index + 1) }}>下移</button><button className={`${button} text-red-300`} disabled={meeting.items.length === 1} onClick={() => { change({ items: meeting.items.filter((_, i) => i !== index) }); setSelected(null) }}>刪除</button></div>
          </div></div>)}
        </fieldset></dialog>}
      </>}
      <fieldset disabled={busy} className="min-w-0">
        {management && !historical && !preview && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-mc-text/70"><p>直接點選紙上的文字、分鐘或紅色姓名編輯；時間會自動重算。</p><button className={button} onClick={() => setSelected(-1)}>日期／時間／更新標示</button></div>}
        <MeetingSheet meeting={shown?.meeting || meeting} marks={shown?.marks} palette={palette} editor={management && !historical && !preview ? { change, itemChange, settings: setSelected, members } : undefined} />
        {management && !historical && !preview && <button className={`${button} mt-4`} onClick={() => { change({ items: [...meeting.items, { id: crypto.randomUUID(), section: 'living', title: '新增節目', minutes: 5, counsel: 0, role: '', person: '', assistant: '', highlight: '' }] }); setSelected(meeting.items.length) }}>＋新增節目</button>}
      </fieldset>
    </>}
  </div>
}
