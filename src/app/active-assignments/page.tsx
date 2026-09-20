'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'

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
const DISTRICT_DOT: Record<DistrictFilter, string> = {
  全部: 'bg-mc-highlight',
  楠梓: 'bg-sky-400',
  橋頭: 'bg-emerald-400',
  梓官: 'bg-violet-400',
}

const LEVEL_STYLE: Record<Level, { badge: string; dot: string; text: string; ring: string }> = {
  ok: {
    badge: 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    ring: 'border-white/10',
  },
  warn: {
    badge: 'bg-yellow-400/10 border-yellow-400/40 text-yellow-300',
    dot: 'bg-yellow-400',
    text: 'text-yellow-300',
    ring: 'border-yellow-400/35',
  },
  danger: {
    badge: 'bg-red-500/10 border-red-500/40 text-red-400',
    dot: 'bg-red-500',
    text: 'text-red-400',
    ring: 'border-red-500/45',
  },
  unknown: {
    badge: 'bg-indigo-400/10 border-indigo-400/35 text-indigo-300',
    dot: 'bg-indigo-400',
    text: 'text-indigo-300',
    ring: 'border-indigo-400/35',
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
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}

function levelOf(days: number | null): Level {
  if (days === null) return 'unknown'
  if (days >= 60) return 'danger'
  if (days >= 30) return 'warn'
  return 'ok'
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

function shortMapLabel(a: AreaRow): string {
  const no = mapNoOf(a)
  return no ? `${districtOf(a)}${no}` : districtOf(a)
}

function sortAreas(a: AreaRow, b: AreaRow): number {
  const da = daysSince(a.dispatchedAt) ?? -1
  const db = daysSince(b.dispatchedAt) ?? -1
  return db - da || (mapNoOf(a) ?? 0) - (mapNoOf(b) ?? 0)
}

function groupStats(areas: AreaRow[]) {
  const stats = { ok: 0, warn: 0, danger: 0, unknown: 0, attention: 0, worstDays: null as number | null, worstLevel: 'ok' as Level }
  for (const a of areas) {
    const days = daysSince(a.dispatchedAt)
    const lv = levelOf(days)
    stats[lv]++
    if (lv !== 'ok') stats.attention++
    if (days === null) {
      if (stats.worstDays === null) stats.worstLevel = 'unknown'
    } else if (stats.worstDays === null || days > stats.worstDays) {
      stats.worstDays = days
      stats.worstLevel = lv
    }
  }
  if (stats.danger > 0) stats.worstLevel = 'danger'
  else if (stats.warn > 0) stats.worstLevel = 'warn'
  else if (stats.unknown > 0) stats.worstLevel = 'unknown'
  else stats.worstLevel = 'ok'
  return stats
}

function makeLineText(groups: MemberGroup[]): string {
  const activeAreas = groups.flatMap((g) => g.areas)
  const warn = activeAreas.filter((a) => levelOf(daysSince(a.dispatchedAt)) === 'warn').length
  const danger = activeAreas.filter((a) => levelOf(daysSince(a.dispatchedAt)) === 'danger').length
  const unknown = activeAreas.filter((a) => levelOf(daysSince(a.dispatchedAt)) === 'unknown').length

  const lines = [
    '【使用中地圖提醒】',
    `目前有 ${activeAreas.length} 張地圖尚未回報 / 收回，${groups.length} 人持有。`,
    `需注意：30–59天 ${warn} 張、60天以上 ${danger} 張、無分發日 ${unknown} 張。`,
    '',
  ]

  for (const g of groups) {
    const areas = [...g.areas].sort(sortAreas)
    lines.push(`${g.memberName}（${areas.length} 張）`)
    lines.push(`- ${areas.map(publicMapLabel).join('、')}`)
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
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
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
              const fields = [publicMapLabel(a), shortMapLabel(a), String(mapNoOf(a) ?? ''), g.memberName, a.assignNote || '']
              if (!fields.some((f) => f.includes(needle))) return false
            }
            return true
          })
          .sort(sortAreas)
        return { ...g, areas, count: areas.length }
      })
      .filter((g) => g.areas.length > 0)
    out.sort((a, b) => {
      const as = groupStats(a.areas)
      const bs = groupStats(b.areas)
      // 領取天數最高的人排最前面；無分發日不壓過有實際天數的項目
      const aw = as.worstDays ?? -1
      const bw = bs.worstDays ?? -1
      return bw - aw || b.areas.length - a.areas.length || sortAreas(a.areas[0], b.areas[0])
    })
    return out
  }, [groups, filter, district, q])

  useEffect(() => {
    if (selectedMemberId && !view.some((g) => g.memberId === selectedMemberId)) {
      setSelectedMemberId(null)
    }
  }, [selectedMemberId, view])

  const lineText = useMemo(() => makeLineText(view), [view])
  const shown = view.reduce((n, g) => n + g.areas.length, 0)

  async function copyLineText() {
    await navigator.clipboard.writeText(lineText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <DashboardLayout>
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-3">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">使用中地圖</h1>
          <p className="text-sm text-mc-text-secondary mt-1">
            點選人員查看每張地圖已領取多久；天數從分發日起算。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-sm rounded-lg bg-mc-card border border-white/10 text-mc-text hover:border-mc-accent/50 transition-colors flex items-center gap-1.5 w-fit"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          更新
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <SummaryCard active={filter === 'all'} label="使用中總張數" value={total} dot="bg-mc-highlight" onClick={() => setFilter('all')} />
        <SummaryCard active={filter === 'attention'} label="需注意" value={stats.attention} dot="bg-orange-400" onClick={() => setFilter('attention')} />
        <SummaryCard active={filter === 'warn'} label="30–59天" value={stats.warn} dot="bg-yellow-400" onClick={() => setFilter('warn')} />
        <SummaryCard active={filter === 'danger'} label="60天以上" value={stats.danger} dot="bg-red-500" onClick={() => setFilter('danger')} />
        <SummaryCard active={filter === 'unknown'} label="無分發日" value={stats.unknown} dot="bg-indigo-400" onClick={() => setFilter('unknown')} />
      </div>

      <div className="mc-card rounded-xl p-3 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋人員或地圖號"
            className="w-full px-3 py-2 text-sm rounded-lg bg-mc-bg border border-white/10 text-mc-text placeholder:text-mc-text-secondary/50 focus:outline-none focus:border-mc-accent"
          />
          <button
            type="button"
            onClick={() => setLineOpen((v) => !v)}
            className="px-4 py-2 rounded-lg bg-mc-highlight/15 text-mc-highlight border border-mc-highlight/35 hover:bg-mc-highlight/25 transition-colors text-sm font-medium"
          >
            {lineOpen ? '收合 LINE 預覽' : '產生 LINE 提醒'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {DISTRICTS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDistrict(d)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-2 ${
                district === d
                  ? 'bg-mc-accent text-white border-mc-accent'
                  : 'bg-white/5 text-mc-text-secondary border-white/10 hover:text-mc-text'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${DISTRICT_DOT[d]}`} />
              {d}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mc-card rounded-xl p-4 text-mc-error text-sm border-red-500/30">載入失敗：{error}</div>}

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <div className="mc-card rounded-xl h-96 animate-pulse" />
          <div className="mc-card rounded-xl h-96 animate-pulse" />
        </div>
      )}

      {!loading && lineOpen && (
        <div className="mc-card rounded-xl overflow-hidden border border-mc-highlight/25">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div>
              <div className="font-semibold text-mc-text">LINE 提醒預覽</div>
              <div className="text-xs text-mc-text-secondary">目前篩選結果：{view.length} 人 / {shown} 張；不顯示 A/B/C 中分區</div>
            </div>
            <button
              type="button"
              onClick={() => void copyLineText()}
              className="px-3 py-1.5 rounded-lg bg-mc-accent text-white text-sm hover:bg-mc-highlight transition-colors"
            >
              {copied ? '已複製 ✓' : '複製'}
            </button>
          </div>
          <pre className="p-4 text-sm text-mc-text-secondary whitespace-pre-wrap leading-relaxed max-h-72 overflow-auto bg-black/20">
            {lineText || '沒有可提醒的項目'}
          </pre>
        </div>
      )}

      {!loading && view.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between text-sm text-mc-text-secondary px-1">
            <span>人員清單・目前篩選結果</span>
            <span>{view.length} 人 / {shown} 張</span>
          </div>
          <div className="space-y-2">
            {view.map((g) => (
              <MemberOverviewCard
                key={g.memberId}
                group={g}
                active={selectedMemberId === g.memberId}
                onClick={() => setSelectedMemberId((current) => current === g.memberId ? null : g.memberId)}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && view.length === 0 && !error && (
        <div className="mc-card rounded-xl p-10 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-mc-text-secondary">目前篩選條件下沒有使用中的地圖</div>
        </div>
      )}
    </div>
    </DashboardLayout>
  )
}

function SummaryCard({ active, label, value, dot, onClick }: { active: boolean; label: string; value: number; dot: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mc-card rounded-xl px-3 py-2 text-left transition-all ${active ? 'ring-2 ring-mc-accent scale-[1.01]' : 'hover:bg-white/[0.04]'}`}
    >
      <div className="flex items-center gap-2 text-xs text-mc-text-secondary">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="text-2xl font-bold text-mc-text leading-tight">{value}</div>
    </button>
  )
}

function MemberOverviewCard({ group, active, onClick }: { group: MemberGroup; active: boolean; onClick: () => void }) {
  const stats = groupStats(group.areas)
  const panelId = `member-maps-${group.memberId}`
  const buttonId = `member-toggle-${group.memberId}`
  const districts = DISTRICTS.slice(1).map((d) => ({ d, count: group.areas.filter((a) => districtOf(a) === d).length })).filter((x) => x.count > 0)

  return (
    <section className={`mc-card rounded-xl overflow-hidden border ${active ? 'border-mc-accent' : LEVEL_STYLE[stats.worstLevel].ring}`}>
      <h2>
        <button
          id={buttonId}
          type="button"
          aria-expanded={active}
          aria-controls={panelId}
          onClick={onClick}
          className="w-full px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mc-highlight"
        >
          <span className="flex items-start gap-2.5">
            <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(group.memberName)} flex items-center justify-center text-white font-bold shrink-0`} aria-hidden="true">
              {group.memberName.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                <span className="font-semibold text-mc-text break-words">{group.memberName}</span>
                <span className="text-sm text-mc-text whitespace-nowrap"><strong className="tabular-nums">{group.areas.length}</strong> 張</span>
                <span className="text-xs text-mc-text-secondary">{stats.worstDays === null ? '分發日未記錄' : `最久已領取 ${stats.worstDays} 天`}</span>
                <span className="ml-auto text-xs text-mc-highlight whitespace-nowrap">{active ? '收合 ▴' : '展開 ▾'}</span>
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-mc-text-secondary">
                {districts.map(({ d, count }) => <span key={d}>{d} {count} 張</span>)}
                {stats.danger > 0 && <MiniBadge level="danger" text={`60天以上 · ${stats.danger} 張`} />}
                {stats.warn > 0 && <MiniBadge level="warn" text={`30–59天 · ${stats.warn} 張`} />}
                {stats.unknown > 0 && <MiniBadge level="unknown" text={`分發日未記錄 · ${stats.unknown} 張`} />}
                {stats.attention === 0 && <MiniBadge level="ok" text="領取未滿30天" />}
              </span>
            </span>
          </span>
        </button>
      </h2>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!active}>
        {active && <MemberMapDetails group={group} />}
      </div>
    </section>
  )
}

function MiniBadge({ level, text }: { level: Level; text: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${LEVEL_STYLE[level].badge}`}><span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${LEVEL_STYLE[level].dot}`} />{text}</span>
}

function MemberMapDetails({ group }: { group: MemberGroup }) {
  return (
    <div className="border-t border-white/10 bg-black/10 px-3 pb-1">
      <p className="py-2 text-xs text-mc-text-secondary">目前篩選的地圖，依領取最久排序；點地圖名稱可開啟圖檔。</p>
      <table className="w-full text-sm">
        <caption className="sr-only">{group.memberName}的地圖與已領取天數</caption>
        <thead>
          <tr className="text-mc-text-secondary border-b border-white/10">
            <th scope="col" className="py-2 text-left font-medium">地圖</th>
            <th scope="col" className="py-2 text-right font-medium">已領取</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {[...group.areas].sort(sortAreas).map((area) => {
            const no = mapNoOf(area)
            const days = daysSince(area.dispatchedAt)
            const level = levelOf(days)
            return (
              <tr key={area.id}>
                <th scope="row" className="py-1.5 pr-3 text-left font-medium text-mc-text">
                  {no && no !== 2 ? (
                    <a href={`/maps/areas/${no}.jpg`} target="_blank" rel="noreferrer" className="inline-block py-1 underline decoration-white/20 underline-offset-4 hover:text-mc-highlight focus-visible:outline-mc-highlight" aria-label={`開啟${publicMapLabel(area)}圖檔（新分頁）`}>
                      {publicMapLabel(area)} <span aria-hidden="true" className="text-mc-text-secondary">↗</span>
                    </a>
                  ) : publicMapLabel(area)}
                </th>
                <td className={`py-1.5 text-right ${LEVEL_STYLE[level].text}`}>
                  {days === null ? <span className="text-xs">分發日未記錄</span> : (
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      {(level === 'warn' || level === 'danger') && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${LEVEL_STYLE[level].dot}`} />}
                      <span><strong className="text-base tabular-nums">{days}</strong> 天</span>
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
