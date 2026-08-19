'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

interface AreaRow {
  id: string
  name: string
  mapId: string | null
  mapAreaId: number | null
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

const MAP_LABEL: Record<string, string> = { nanzih: '楠梓', chiaotou: '橋頭', tzuguan: '梓官' }

type Level = 'ok' | 'warn' | 'danger' | 'unknown'

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

const CHIP_CLS: Record<Level, string> = {
  ok: 'bg-white/5 border-white/10 text-mc-text',
  warn: 'bg-yellow-400/10 border-yellow-400/40 text-yellow-300',
  danger: 'bg-red-500/10 border-red-500/40 text-red-400',
  unknown: 'bg-white/5 border-white/10 text-mc-text-secondary',
}

const DOT_CLS: Record<Level, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-yellow-400',
  danger: 'bg-red-500',
  unknown: 'bg-gray-500',
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

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

type FilterKey = 'all' | 'warn' | 'danger'

export default function ActiveAssignmentsPage() {
  const [groups, setGroups] = useState<MemberGroup[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [detail, setDetail] = useState<{ area: AreaRow; memberName: string } | null>(null)

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
    let warn = 0
    let danger = 0
    for (const g of groups)
      for (const a of g.areas) {
        const lv = levelOf(daysSince(a.dispatchedAt))
        if (lv === 'warn') warn++
        else if (lv === 'danger') danger++
      }
    return { warn, danger }
  }, [groups])

  const view = useMemo(() => {
    // filter areas per member by level, drop empty members, sort: worst days first
    const out = groups
      .map((g) => ({
        ...g,
        areas: g.areas
          .filter((a) => {
            const lv = levelOf(daysSince(a.dispatchedAt))
            return filter === 'all' || lv === filter
          })
          .sort((x, y) => (daysSince(y.dispatchedAt) ?? -1) - (daysSince(x.dispatchedAt) ?? -1)),
      }))
      .filter((g) => g.areas.length > 0)
    out.sort(
      (a, b) =>
        (daysSince(b.areas[0].dispatchedAt) ?? -1) - (daysSince(a.areas[0].dispatchedAt) ?? -1)
    )
    return out
  }, [groups, filter])

  const shown = view.reduce((n, g) => n + g.areas.length, 0)

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">使用中地圖</h1>
          <p className="text-sm text-mc-text-secondary mt-1">
            目前在外未收回的地圖與負責人員（未完成或未回報）
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

      {/* 統計＋篩選（合併成一列卡片，點擊即篩選） */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`mc-card rounded-xl p-4 text-left transition-all ${
            filter === 'all' ? 'ring-2 ring-mc-accent' : 'hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-mc-text-secondary">
            <span className="w-2 h-2 rounded-full bg-mc-highlight" />
            全部使用中
          </div>
          <div className="text-3xl font-bold text-mc-text mt-1">{total}</div>
        </button>
        <button
          type="button"
          onClick={() => setFilter('warn')}
          className={`mc-card rounded-xl p-4 text-left transition-all ${
            filter === 'warn' ? 'ring-2 ring-yellow-400' : 'hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-mc-text-secondary">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            超過 30 天 🔶
          </div>
          <div className={`text-3xl font-bold mt-1 ${stats.warn > 0 ? 'text-yellow-400' : 'text-mc-text'}`}>
            {stats.warn}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setFilter('danger')}
          className={`mc-card rounded-xl p-4 text-left transition-all ${
            filter === 'danger' ? 'ring-2 ring-red-500' : 'hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-mc-text-secondary">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            超過 60 天 ⚠️
          </div>
          <div className={`text-3xl font-bold mt-1 ${stats.danger > 0 ? 'text-red-400' : 'text-mc-text'}`}>
            {stats.danger}
          </div>
        </button>
      </div>

      {error && (
        <div className="mc-card rounded-xl p-4 text-mc-error text-sm border-red-500/30">載入失敗：{error}</div>
      )}

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="mc-card rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      )}

      {/* 人員卡片 */}
      {!loading && view.map((g) => {
        const worst = daysSince(g.areas[0].dispatchedAt)
        const worstLv = levelOf(worst)
        return (
          <div key={g.memberId} className="mc-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(g.memberName)} flex items-center justify-center text-white font-bold text-sm shrink-0`}
              >
                {g.memberName.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-mc-text truncate">{g.memberName}</div>
                <div className="text-xs text-mc-text-secondary">
                  {g.areas.length} 張地圖使用中
                </div>
              </div>
              {worstLv !== 'ok' && (
                <span
                  className={`ml-auto shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${CHIP_CLS[worstLv]}`}
                >
                  最久 {worst} 天 {worstLv === 'danger' ? '⚠️' : '🔶'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {g.areas.map((a) => {
                const d = daysSince(a.dispatchedAt)
                const lv = levelOf(d)
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setDetail({ area: a, memberName: g.memberName })}
                    className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-transform hover:scale-105 ${CHIP_CLS[lv]}`}
                    title={`${a.name}｜${fmtDate(a.dispatchedAt)} 分發`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLS[lv]}`} />
                    {a.blockCode || a.name}
                    <span className="opacity-60">·</span>
                    <span className="tabular-nums">{d === null ? '?' : d} 天</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {!loading && view.length === 0 && !error && (
        <div className="mc-card rounded-xl p-10 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-mc-text-secondary">
            {filter === 'all' ? '目前沒有使用中的地圖' : '這個篩選條件下沒有地圖'}
          </div>
        </div>
      )}

      {!loading && view.length > 0 && (
        <div className="text-xs text-mc-text-secondary text-center">
          共 {shown} 張 · 點標籤可看地圖與詳細資訊
        </div>
      )}

      {/* 詳細彈窗 */}
      {detail && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="mc-card rounded-2xl max-w-sm w-full overflow-hidden border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex items-start justify-between border-b border-white/10">
              <div>
                <div className="font-bold text-mc-text text-lg">{detail.area.blockCode || detail.area.name}</div>
                <div className="text-xs text-mc-text-secondary mt-0.5">
                  {detail.area.name}
                  {detail.area.mapId ? ` · ${MAP_LABEL[detail.area.mapId]}` : ''}
                  {detail.area.mapAreaId ? ` 第 ${detail.area.mapAreaId} 區` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-mc-text-secondary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {detail.area.mapAreaId && (
              <div className="bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/maps/areas/thumbs/${detail.area.mapAreaId}-list.webp`}
                  alt={`${detail.area.name} 地圖`}
                  className="w-full max-h-56 object-contain"
                />
              </div>
            )}
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-mc-text-secondary">負責人</span>
                <span className="text-mc-text font-medium">{detail.memberName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mc-text-secondary">分發日</span>
                <span className="text-mc-text">{fmtDate(detail.area.dispatchedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mc-text-secondary">經過天數</span>
                <span
                  className={`font-semibold ${
                    levelOf(daysSince(detail.area.dispatchedAt)) === 'danger'
                      ? 'text-red-400'
                      : levelOf(daysSince(detail.area.dispatchedAt)) === 'warn'
                        ? 'text-yellow-400'
                        : 'text-mc-text'
                  }`}
                >
                  {daysSince(detail.area.dispatchedAt) ?? '?'} 天
                </span>
              </div>
              {detail.area.assignNote && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-mc-text-secondary text-xs mb-1">備註</div>
                  <div className="text-mc-text">{detail.area.assignNote}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
