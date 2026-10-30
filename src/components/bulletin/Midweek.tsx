'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { addDays, type Meeting } from '@/lib/midweek'
import MeetingSheet from './MeetingSheet'
import styles from './Midweek.module.css'
import type { MeetingVersion, Palette } from '@/lib/midweek-versions'

type Week = { id: string; date: string; reading: string }
const field = 'w-full min-w-0 min-h-11 rounded-lg border border-white/15 bg-mc-card px-3 py-2 text-base font-normal text-mc-text'
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...options })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '讀取失敗')
  return data
}
// 公開節目表；編排頁改用 MidweekManager 連續列出多週（ADR-0099）。
// embedded：外部網站 iframe 用，不查登入身分、不顯示編排入口（ADR-0085）。
export default function Midweek({ embedded = false }: { embedded?: boolean }) {
  const [weeks, setWeeks] = useState<Week[]>([]), [id, setId] = useState('')
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [publicVersionNumber, setPublicVersionNumber] = useState<number | null>(null)
  const [versions, setVersions] = useState<MeetingVersion[]>([])
  const [palette, setPalette] = useState<Palette>({})
  const shown = versions.find(version => version.number === publicVersionNumber) || versions.at(-1)
  const alive = useRef(true)
  useEffect(() => {
    let active = true
    const refreshColors = () => { if (document.visibilityState === 'visible') api('/api/midweek?palette=1').then(data=>{if(active)setPalette(data.palette)}).catch(()=>{}) }
    window.addEventListener('focus', refreshColors)
    const timer = window.setInterval(refreshColors, 30000)
    return () => { active=false; window.removeEventListener('focus',refreshColors); window.clearInterval(timer) }
  }, [])
  useEffect(() => {
    alive.current = true
    api('/api/midweek').then(data => {
      if (!alive.current) return
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const choices: Week[] = [...data.weeks].sort((a: Week, b: Week) => a.date.localeCompare(b.date))
      setWeeks(choices)
      const requested = new URLSearchParams(window.location.search).get('week')
      setId(requested && choices.some(w => w.id === requested) ? requested : choices.find(w => w.date >= addDays(today, -3))?.id || choices.at(-1)?.id || '')
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
    if (!embedded) api('/api/me').then(data => setIsAdmin(data.role === 'admin' || data.user?.role === 'admin')).catch(() => {})
    return () => { alive.current = false }
  }, [embedded])
  useEffect(() => {
    if (!id) { setMeeting(null); return }
    const controller = new AbortController()
    setVersions([]); setPublicVersionNumber(null); setLoading(true); setMeeting(null); setError('')
    api(`/api/midweek?id=${id}`, { signal: controller.signal }).then(data => {
      setMeeting(data.meeting); setVersions(data.versions || []); setPublicVersionNumber(data.publishedVersion ?? null)
      setPalette(data.palette || {})
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id])
  const weekIndex = weeks.findIndex(week => week.id === id)
  const switchWeek = (nextId?: string) => { if (nextId && nextId !== id && !loading) setId(nextId) }
  const weekButton = `${styles.weekButton} flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-mc-highlight bg-mc-highlight/30 px-5 py-3 text-base font-semibold text-mc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mc-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-mc-bg disabled:cursor-not-allowed disabled:border-mc-text/10 disabled:bg-mc-accent/40 disabled:text-mc-text/35`
  const readerButton = 'flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg px-2 hover:bg-mc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-30'
  return <div className="space-y-2">
    <div className="flex items-center gap-1 sm:gap-2">
      <select aria-label="選擇週次" className={`${field} !w-0 flex-1 !px-2 text-sm`} value={id} disabled={loading} onChange={e => switchWeek(e.target.value)}>
        {!weeks.length && <option value="">尚未發布節目</option>}
        {weeks.map(w => <option key={w.id} value={w.id}>{w.date.slice(5).replace('-', '/')}</option>)}
      </select>
      {isAdmin && <Link aria-label="編排節目" title="編排節目" className={readerButton} href="/midweek/manage"><Pencil aria-hidden="true" className="h-4 w-4" /><span className="text-sm">編排</span></Link>}
    </div>
    <nav aria-label="切換週次" className="grid grid-cols-2 gap-3">
      <button aria-label="前一週" className={`${weekButton} ${styles.previous}`} disabled={loading || weekIndex <= 0} onClick={() => switchWeek(weeks[weekIndex - 1]?.id)}><ChevronLeft aria-hidden="true" className="h-6 w-6 shrink-0" />前一週</button>
      <button aria-label="下一週" className={weekButton} disabled={loading || weekIndex < 0 || weekIndex >= weeks.length - 1} onClick={() => switchWeek(weeks[weekIndex + 1]?.id)}>下一週<ChevronRight aria-hidden="true" className="h-6 w-6 shrink-0" /></button>
    </nav>
    {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-red-300">{error}</p>}
    {loading && <p role="status">載入中…</p>}
    {!loading && !meeting && !error && <p className="py-8 text-mc-text/60">目前沒有已發布的週中聚會節目。</p>}
    {meeting && <MeetingSheet meeting={shown?.meeting || meeting} marks={shown?.marks} palette={palette} />}
  </div>
}
