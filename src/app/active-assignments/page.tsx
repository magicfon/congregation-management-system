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
const DISTRICT_DOT: Record<DistrictFilter, string> = {
  全部: 'bg-mc-highlight',
  楠梓: 'bg-sky-400',
  橋頭: 'bg-emerald-400',
  梓官: 'bg-violet-400',
}

const LEVEL_LABEL: Record<Level, string> = {
  ok: '30天內',
  warn: '30天以上',
  danger: '60天以上',
  unknown: '無日期',
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
  const da = daysSince(a.dispatchedAt) ?? 9999
  const db = daysSince(b.dispatchedAt) ?? 9999
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
    `需注意：30天以上 ${warn} 張、60天以上 ${danger} 張、無分發日 ${unknown} 張。`,
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
    out.sort((a, b) => b.areas.length - a.areas.length || sortAreas(a.areas[0], b.areas[0]))
    return out
  }, [groups, filter, district, q])

  useEffect(() => {
    if (view.length === 0) {
      setSelectedMemberId(null)
      return
    }
    if (!selectedMemberId || !view.some((g) => g.memberId === selectedMemberId)) {
      setSelectedMemberId(view[0].memberId)
    }
  }, [selectedMemberId, view])

  const selectedGroup = view.find((g) => g.memberId === selectedMemberId) || view[0]
  const lineText = useMemo(() => makeLineText(view), [view])
  const shown = view.reduce((n, g) => n + g.areas.length, 0)

  async function copyLineText() {
    await navigator.clipboard.writeText(lineText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">使用中地圖</h1>
          <p className="text-sm text-mc-text-secondary mt-1">
            人員總覽優先：先看誰手上有幾張，再點人員查看簡要地圖號
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard active={filter === 'all'} label="使用中總張數" value={total} dot="bg-mc-highlight" onClick={() => setFilter('all')} />
        <SummaryCard active={filter === 'attention'} label="需注意" value={stats.attention} dot="bg-orange-400" onClick={() => setFilter('attention')} />
        <SummaryCard active={filter === 'warn'} label="30天以上" value={stats.warn} dot="bg-yellow-400" onClick={() => setFilter('warn')} />
        <SummaryCard active={filter === 'danger'} label="60天以上" value={stats.danger} dot="bg-red-500" onClick={() => setFilter('danger')} />
        <SummaryCard active={filter === 'unknown'} label="無分發日" value={stats.unknown} dot="bg-indigo-400" onClick={() => setFilter('unknown')} />
      </div>

      <div className="mc-card rounded-xl p-4 space-y-3">
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
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
          <section className="space-y-3">
            <div className="flex items-center justify-between text-sm text-mc-text-secondary px-1">
              <span>人員清單</span>
              <span>{view.length} 人 / {shown} 張</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {view.map((g) => (
                <MemberOverviewCard
                  key={g.memberId}
                  group={g}
                  active={selectedGroup?.memberId === g.memberId}
                  onClick={() => setSelectedMemberId(g.memberId)}
                />
              ))}
            </div>
          </section>

          <SelectedMemberPanel group={selectedGroup} />
        </div>
      )}

      {!loading && view.length === 0 && !error && (
        <div className="mc-card rounded-xl p-10 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-mc-text-secondary">目前篩選條件下沒有使用中的地圖</div>
        </div>
      )}
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

function MemberOverviewCard({ group, active, onClick }: { group: MemberGroup; active: boolean; onClick: () => void }) {
  const stats = groupStats(group.areas)
  const topAreas = group.areas.slice(0, 8)
  const extra = Math.max(0, group.areas.length - topAreas.length)
  const districts = DISTRICTS.slice(1).map((d) => ({ d, count: group.areas.filter((a) => districtOf(a) === d).length })).filter((x) => x.count > 0)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`mc-card rounded-xl p-4 text-left border transition-all hover:bg-white/[0.04] ${active ? 'border-mc-accent ring-2 ring-mc-accent/30' : LEVEL_STYLE[stats.worstLevel].ring}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient(group.memberName)} flex items-center justify-center text-white font-bold shrink-0 text-lg`}>
          {group.memberName.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-mc-text text-lg truncate">{group.memberName}</h2>
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold text-mc-text leading-none">{group.areas.length}</div>
              <div className="text-xs text-mc-text-secondary mt-0.5">張</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {stats.danger > 0 && <MiniBadge level="danger" text={`60+ ${stats.danger}`} />}
            {stats.warn > 0 && <MiniBadge level="warn" text={`30+ ${stats.warn}`} />}
            {stats.unknown > 0 && <MiniBadge level="unknown" text={`無日期 ${stats.unknown}`} />}
            {stats.attention === 0 && <MiniBadge level="ok" text="正常" />}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {districts.map(({ d, count }) => (
              <span key={d} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-mc-text-secondary border border-white/10">
                <span className={`w-1.5 h-1.5 rounded-full ${DISTRICT_DOT[d]}`} />
                {d} {count}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {topAreas.map((a) => (
              <span key={a.id} className="rounded-md bg-black/20 border border-white/10 px-2 py-0.5 text-xs text-mc-text-secondary">
                {shortMapLabel(a)}
              </span>
            ))}
            {extra > 0 && <span className="rounded-md bg-mc-accent/10 border border-mc-accent/30 px-2 py-0.5 text-xs text-mc-highlight">+{extra}</span>}
          </div>
        </div>
      </div>
    </button>
  )
}

function MiniBadge({ level, text }: { level: Level; text: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${LEVEL_STYLE[level].badge}`}><span className={`w-1.5 h-1.5 rounded-full ${LEVEL_STYLE[level].dot}`} />{text}</span>
}

function SelectedMemberPanel({ group }: { group?: MemberGroup }) {
  if (!group) return null
  const stats = groupStats(group.areas)
  const areasByDistrict = DISTRICTS.slice(1).map((d) => ({ d, areas: group.areas.filter((a) => districtOf(a) === d) })).filter((x) => x.areas.length > 0)

  return (
    <aside className="mc-card rounded-xl p-4 xl:sticky xl:top-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(group.memberName)} flex items-center justify-center text-white font-bold shrink-0`}>
          {group.memberName.slice(0, 1)}
        </div>
        <div>
          <div className="text-xs text-mc-text-secondary">目前選取</div>
          <div className="font-semibold text-mc-text text-lg">{group.memberName}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PanelMetric label="使用中" value={`${group.areas.length} 張`} />
        <PanelMetric label="需注意" value={`${stats.attention} 張`} valueClass={stats.attention > 0 ? 'text-yellow-300' : 'text-mc-text'} />
      </div>

      <div className="text-xs text-mc-text-secondary leading-relaxed">
        這裡只列簡要地圖號；需要看圖時再點地圖號開啟圖檔，避免畫面一次塞太多細節。
      </div>

      <div className="space-y-3">
        {areasByDistrict.map(({ d, areas }) => (
          <div key={d}>
            <div className="flex items-center gap-2 text-sm font-medium text-mc-text mb-2">
              <span className={`w-2 h-2 rounded-full ${DISTRICT_DOT[d]}`} />
              {d}（{areas.length}）
            </div>
            <div className="flex flex-wrap gap-2">
              {areas.map((a) => {
                const no = mapNoOf(a)
                const lv = levelOf(daysSince(a.dispatchedAt))
                return no && no !== 2 ? (
                  <a
                    key={a.id}
                    href={`/maps/areas/${no}.jpg`}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-lg px-2.5 py-1 text-sm border ${LEVEL_STYLE[lv].badge} hover:bg-white/10 transition-colors`}
                    title={publicMapLabel(a)}
                  >
                    {no}號
                  </a>
                ) : (
                  <span key={a.id} className={`rounded-lg px-2.5 py-1 text-sm border ${LEVEL_STYLE[lv].badge}`}>{publicMapLabel(a)}</span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

function PanelMetric({ label, value, valueClass = 'text-mc-text' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <div className="text-xs text-mc-text-secondary">{label}</div>
      <div className={`font-bold text-lg ${valueClass}`}>{value}</div>
    </div>
  )
}
