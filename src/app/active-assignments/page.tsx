'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

interface AreaRow {
  id: string
  name: string
  mapId: string | null
  mapAreaId: number | null
  sheetNo: number | null
  blockCode: string | null
  assignedMemberId: string
  assignedTo: string | null
  assignNote: string | null
  dispatchedAt: string | null
  completedAt: string | null
}

interface MemberGroup {
  memberId: string
  memberName: string
  count: number
  areas: AreaRow[]
}

type Level = 'ok' | 'warn' | 'danger' | 'unknown'
type FilterKey = 'all' | 'attention' | 'warn' | 'danger' | 'unknown'
type DistrictFilter = '全部' | '楠梓' | '橋頭' | '梓官'

const DISTRICTS: DistrictFilter[] = ['全部', '楠梓', '橋頭', '梓官']
const MAP_LABEL: Record<string, DistrictFilter> = { nanzih: '楠梓', chiaotou: '橋頭', tzuguan: '梓官' }

const LEVEL_LABEL: Record<Level, string> = {
  ok: '30 天內',
  warn: '超過 30 天',
  danger: '超過 60 天',
  unknown: '無分發日',
}

const LEVEL_STYLE: Record<Level, { row: string; badge: string; dot: string; text: string }> = {
  ok: {
    row: 'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]',
    badge: 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300',
    dot: 'bg-emerald-400',
    text: 'text-mc-text-secondary',
  },
  warn: {
    row: 'border-yellow-400/25 bg-yellow-400/[0.06] hover:bg-yellow-400/[0.1]',
    badge: 'bg-yellow-400/10 border-yellow-400/40 text-yellow-300',
    dot: 'bg-yellow-400',
    text: 'text-yellow-300',
  },
  danger: {
    row: 'border-red-500/35 bg-red-500/[0.07] hover:bg-red-500/[0.11]',
    badge: 'bg-red-500/10 border-red-500/40 text-red-400',
    dot: 'bg-red-500',
    text: 'text-red-400',
  },
  unknown: {
    row: 'border-indigo-400/25 bg-indigo-400/[0.05] hover:bg-indigo-400/[0.09]',
    badge: 'bg-indigo-400/10 border-indigo-400/35 text-indigo-300',
    dot: 'bg-indigo-400',
    text: 'text-indigo-300',
  },
}

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-purple-500',
  'from-sky-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
  'from-violet-500 to-fuchsia-500',
]

function avatarGradient(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function levelOf(days: number | null): Level {
  if (days === null) return 'unknown'
  if (days >= 60) return 'danger'
  if (days >= 30) return 'warn'
  return 'ok'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function districtOf(a: AreaRow): DistrictFilter {
  if (a.mapId && MAP_LABEL[a.mapId]) return MAP_LABEL[a.mapId]
  const n = a.sheetNo ?? a.mapAreaId ?? 0
  if (n >= 1 && n <= 89) return '楠梓'
  if (n >= 90 && n <= 148) return '橋頭'
  if (n >= 149 && n <= 213) return '梓官'
  return '楠梓'
}

function mapNoOf(a: AreaRow): number | null {
  return a.sheetNo ?? a.mapAreaId ?? null
}

/** 對外提醒用：不要顯示 A/B/C 中分區，只顯示地區＋地圖號碼 */
function publicMapLabel(a: AreaRow): string {
  const no = mapNoOf(a)
  return `${districtOf(a)}${no ? ` ${no}號` : ''}`
}

function internalLabel(a: AreaRow): string {
  return a.blockCode || a.name
}

function sortAreas(a: AreaRow, b: AreaRow): number {
  const da = daysSince(a.dispatchedAt) ?? 9999
  const db = daysSince(b.dispatchedAt) ?? 9999
  return db - da || (mapNoOf(a) ?? 0) - (mapNoOf(b) ?? 0)
}

function makeLineText(groups: MemberGroup[]): string {
  const activeAreas = groups.flatMap((g) => g.areas)
  const warn = activeAreas.filter((a) => levelOf(daysSince(a.dispatchedAt)) === 'warn').length
  const danger = activeAreas.filter((a) => levelOf(daysSince(a.dispatchedAt)) === 'danger').length
  const unknown = activeAreas.filter((a) => levelOf(daysSince(a.dispatchedAt)) === 'unknown').length

  const lines = [
    '【使用中地圖提醒】',
    `目前有 ${activeAreas.length} 張地圖尚未回報 / 收回，${groups.length} 人持有。`,
    `需注意：30天以上 ${warn} 張、60天以上 ${danger} 張、無分發日 ${unknown} 張。`,
    '',
  ]

  for (const g of groups) {
    const areas = [...g.areas].sort(sortAreas)
    const worst = daysSince(areas[0]?.dispatchedAt ?? null)
    const head = worst === null ? `${g.memberName}（${areas.length} 張）` : `${g.memberName}（${areas.length} 張，最久 ${worst} 天）`
    lines.push(head)
    for (const a of areas) {
      const d = daysSince(a.dispatchedAt)
      const prefix = levelOf(d) === 'danger' ? '⚠️ ' : levelOf(d) === 'warn' ? '🔶 ' : ''
      const date = a.dispatchedAt ? `，分發 ${fmtDate(a.dispatchedAt)}` : '，無分發日'
      const note = a.assignNote ? `，備註：${a.assignNote}` : ''
      lines.push(`- ${prefix}${publicMapLabel(a)}：${d === null ? '未記錄天數' : `已 ${d} 天`}${date}${note}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

export default function ActiveAssignmentsPage() {
  const [groups, setGroups] = useState<MemberGroup[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [district, setDistrict] = useState<DistrictFilter>('全部')
  const [q, setQ] = useState('')
  const [lineOpen, setLineOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/areas/dispatched')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setGroups(d.groups)
      setTotal(d.totalDispatched)
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    let ok = 0, warn = 0, danger = 0, unknown = 0
    for (const g of groups) {
      for (const a of g.areas) {
        const lv = levelOf(daysSince(a.dispatchedAt))
        if (lv === 'ok') ok++
        if (lv === 'warn') warn++
        if (lv === 'danger') danger++
        if (lv === 'unknown') unknown++
      }
    }
    return { ok, warn, danger, unknown, attention: warn + danger + unknown }
  }, [groups])

  const view = useMemo(() => {
    const needle = q.trim()
    const out = groups
      .map((g) => {
        const areas = g.areas
          .filter((a) => {
            const lv = levelOf(daysSince(a.dispatchedAt))
            if (filter === 'attention' && lv === 'ok') return false
            if (filter !== 'all' && filter !== 'attention' && lv !== filter) return false
            if (district !== '全部' && districtOf(a) !== district) return false
            if (needle) {
              const fields = [publicMapLabel(a), internalLabel(a), String(mapNoOf(a) ?? ''), g.memberName, a.assignNote || '']
              if (!fields.some((f) => f.includes(needle))) return false
            }
            return true
          })
          .sort(sortAreas)
        return { ...g, areas, count: areas.length }
      })
      .filter((g) => g.areas.length > 0)
    out.sort((a, b) => sortAreas(a.areas[0], b.areas[0]))
    return out
  }, [groups, filter, district, q])

  const lineText = useMemo(() => makeLineText(view), [view])
  const shown = view.reduce((n, g) => n + g.areas.length, 0)

  async function copyLineText() {
    await navigator.clipboard.writeText(lineText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">使用中地圖</h1>
          <p className="text-sm text-mc-text-secondary mt-1">
            待催收工作台：快速確認誰手上還有地圖未完成或未回報
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-sm rounded-lg bg-mc-card border border-white/10 text-mc-text hover:border-mc-accent/50 transition-colors flex items-center gap-1.5"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          更新
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard active={filter === 'all'} label="全部" value={total} dot="bg-mc-highlight" onClick={() => setFilter('all')} />
        <SummaryCard active={filter === 'attention'} label="需注意" value={stats.attention} dot="bg-orange-400" onClick={() => setFilter('attention')} />
        <SummaryCard active={filter === 'warn'} label="30 天以上" value={stats.warn} dot="bg-yellow-400" onClick={() => setFilter('warn')} />
        <SummaryCard active={filter === 'danger'} label="60 天以上" value={stats.danger} dot="bg-red-500" onClick={() => setFilter('danger')} />
        <SummaryCard active={filter === 'unknown'} label="無分發日" value={stats.unknown} dot="bg-indigo-400" onClick={() => setFilter('unknown')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
        <aside className="mc-card rounded-xl p-4 space-y-4 lg:sticky lg:top-4">
          <div>
            <div className="text-sm font-semibold text-mc-text mb-2">篩選</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋人員、地圖號、備註"
              className="w-full px-3 py-2 text-sm rounded-lg bg-mc-bg border border-white/10 text-mc-text placeholder:text-mc-text-secondary/50 focus:outline-none focus:border-mc-accent"
            />
          </div>

          <div>
            <div className="text-xs text-mc-text-secondary mb-2">地區</div>
            <div className="grid grid-cols-2 gap-2">
              {DISTRICTS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistrict(d)}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    district === d
                      ? 'bg-mc-accent text-white border-mc-accent'
                      : 'bg-white/5 text-mc-text-secondary border-white/10 hover:text-mc-text'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLineOpen((v) => !v)}
            className="w-full px-3 py-2 rounded-lg bg-mc-highlight/15 text-mc-highlight border border-mc-highlight/35 hover:bg-mc-highlight/25 transition-colors text-sm font-medium"
          >
            {lineOpen ? '收合 LINE 預覽' : '產生 LINE 提醒文字'}
          </button>

          <div className="text-xs text-mc-text-secondary leading-relaxed">
            提醒文字只顯示「楠梓 80號」這種格式，不顯示 A-80 / B-100 / C-149 中分區代碼。
          </div>
        </aside>

        <main className="space-y-4">
          {error && <div className="mc-card rounded-xl p-4 text-mc-error text-sm border-red-500/30">載入失敗：{error}</div>}

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="mc-card rounded-xl h-32 animate-pulse" />)}
            </div>
          )}

          {!loading && lineOpen && (
            <div className="mc-card rounded-xl overflow-hidden border border-mc-highlight/25">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div>
                  <div className="font-semibold text-mc-text">LINE 提醒預覽</div>
                  <div className="text-xs text-mc-text-secondary">目前篩選結果：{shown} 張</div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyLineText()}
                  className="px-3 py-1.5 rounded-lg bg-mc-accent text-white text-sm hover:bg-mc-highlight transition-colors"
                >
                  {copied ? '已複製 ✓' : '複製'}
                </button>
              </div>
              <pre className="p-4 text-sm text-mc-text-secondary whitespace-pre-wrap leading-relaxed max-h-80 overflow-auto bg-black/20">
                {lineText || '沒有可提醒的項目'}
              </pre>
            </div>
          )}

          {!loading && view.map((g) => <MemberCard key={g.memberId} group={g} />)}

          {!loading && view.length === 0 && !error && (
            <div className="mc-card rounded-xl p-10 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <div className="text-mc-text-secondary">目前篩選條件下沒有待處理地圖</div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function SummaryCard({ active, label, value, dot, onClick }: { active: boolean; label: string; value: number; dot: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mc-card rounded-xl p-4 text-left transition-all ${active ? 'ring-2 ring-mc-accent scale-[1.01]' : 'hover:bg-white/[0.04]'}`}
    >
      <div className="flex items-center gap-2 text-xs text-mc-text-secondary">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="text-3xl font-bold text-mc-text mt-1">{value}</div>
    </button>
  )
}

function MemberCard({ group }: { group: MemberGroup }) {
  const levels = group.areas.map((a) => levelOf(daysSince(a.dispatchedAt)))
  const count = (lv: Level) => levels.filter((x) => x === lv).length
  const worstDays = daysSince(group.areas[0]?.dispatchedAt ?? null)
  const worstLevel = levelOf(worstDays)

  return (
    <section className="mc-card rounded-xl overflow-hidden">
      <div className="p-4 md:p-5 border-b border-white/10 flex items-center gap-3">
        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(group.memberName)} flex items-center justify-center text-white font-bold shrink-0`}>
          {group.memberName.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-mc-text text-lg truncate">{group.memberName}</h2>
            <span className="px-2 py-0.5 rounded-full text-xs bg-mc-accent/15 text-mc-highlight border border-mc-accent/35">{group.areas.length} 張</span>
            {worstDays !== null && (
              <span className={`px-2 py-0.5 rounded-full text-xs border ${LEVEL_STYLE[worstLevel].badge}`}>最久 {worstDays} 天</span>
            )}
          </div>
          <div className="text-xs text-mc-text-secondary mt-1">
            30天內 {count('ok')}｜30+ {count('warn')}｜60+ {count('danger')}｜無日期 {count('unknown')}
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {group.areas.map((a) => {
          const days = daysSince(a.dispatchedAt)
          const lv = levelOf(days)
          return <AreaItem key={a.id} area={a} days={days} level={lv} />
        })}
      </div>
    </section>
  )
}

function AreaItem({ area, days, level }: { area: AreaRow; days: number | null; level: Level }) {
  const mapNo = mapNoOf(area)
  const hasImage = mapNo !== null && mapNo !== 2
  return (
    <div className={`p-3 md:p-4 border-l-4 ${LEVEL_STYLE[level].row} transition-colors`}>
      <div className="flex gap-3 items-start">
        {hasImage && (
          <a href={`/maps/areas/${mapNo}.jpg`} target="_blank" rel="noreferrer" className="hidden sm:block shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/maps/areas/thumbs/${mapNo}-list.webp`}
              alt={`${publicMapLabel(area)} 地圖`}
              className="w-20 h-20 object-contain rounded-lg bg-black/25 border border-white/10"
              loading="lazy"
            />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${LEVEL_STYLE[level].dot}`} />
            <span className="font-semibold text-mc-text">{publicMapLabel(area)}</span>
            <span className="text-xs text-mc-text-secondary">內部分區：{internalLabel(area)}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Info label="分發日" value={fmtDate(area.dispatchedAt)} />
            <Info label="經過" value={days === null ? '無日期' : `${days} 天`} valueClass={LEVEL_STYLE[level].text} />
            <Info label="狀態" value={LEVEL_LABEL[level]} valueClass={LEVEL_STYLE[level].text} />
            {hasImage ? (
              <a href={`/maps/areas/${mapNo}.jpg`} target="_blank" rel="noreferrer" className="text-mc-highlight hover:underline self-end">
                開啟地圖
              </a>
            ) : (
              <Info label="地圖" value="無圖檔" />
            )}
          </div>
          {area.assignNote && (
            <div className="mt-2 text-xs text-yellow-200/90 bg-yellow-400/10 border border-yellow-400/25 rounded-lg px-2 py-1">
              備註：{area.assignNote}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value, valueClass = 'text-mc-text' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-mc-text-secondary/70">{label}</div>
      <div className={`font-medium ${valueClass}`}>{value}</div>
    </div>
  )
}
