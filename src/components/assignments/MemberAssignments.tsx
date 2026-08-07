'use client'

import { useState, useEffect, useCallback } from 'react'

type DispatchedArea = {
  id: string
  name: string
  mapId: string | null
  mapAreaId: number | null
  blockCode: string | null
  assignedMemberId: string | null
  assignedTo: string | null
  assignNote: string | null
  dispatchedAt: string | null
  completedAt: string | null
}

type MemberGroup = {
  memberId: string
  memberName: string
  count: number
  areas: DispatchedArea[]
}

type ApiResponse = {
  totalDispatched: number
  memberCount: number
  groups: MemberGroup[]
}

function daysSince(dateStr: string | null): string {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天`
  const months = Math.floor(days / 30)
  return `${months} 個月`
}

function mapLabel(mapId: string | null): string {
  switch (mapId) {
    case 'nanzih': return '楠梓'
    case 'chiaotou': return '橋頭'
    case 'tzuguan': return '梓官'
    default: return mapId || '—'
  }
}

export default function MemberAssignments({ isAdmin }: { isAdmin: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collecting, setCollecting] = useState(false)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/areas/dispatched')
      if (!res.ok) throw new Error('載入失敗')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知錯誤')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleSelect = (areaId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(areaId)) next.delete(areaId)
      else next.add(areaId)
      return next
    })
  }

  const selectAllForMember = (memberId: string) => {
    const group = data?.groups.find(g => g.memberId === memberId)
    if (!group) return
    setSelected(prev => {
      const next = new Set(prev)
      // If all are selected, deselect all for this member
      const allSelected = group.areas.every(a => next.has(a.id))
      if (allSelected) {
        group.areas.forEach(a => next.delete(a.id))
      } else {
        group.areas.forEach(a => next.add(a.id))
      }
      return next
    })
  }

  const handleCollect = async () => {
    if (selected.size === 0) return
    setCollecting(true)
    try {
      const res = await fetch('/api/areas/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaIds: Array.from(selected) }),
      })
      if (!res.ok) throw new Error('收回失敗')
      setSelected(new Set())
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : '收回失敗')
    } finally {
      setCollecting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-mc-text/40">載入中…</div>
  }
  if (error) {
    return <div className="text-mc-error py-8 text-center">{error}</div>
  }
  if (!data || data.groups.length === 0) {
    return <div className="text-mc-text/40 py-20 text-center">目前沒有分發中的地圖</div>
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-4 text-sm">
          <span className="text-mc-text/60">
            <span className="text-mc-highlight text-lg font-bold">{data.totalDispatched}</span> 張分發中
          </span>
          <span className="text-mc-text/60">
            <span className="text-mc-highlight text-lg font-bold">{data.memberCount}</span> 人持有
          </span>
        </div>
        {isAdmin && selected.size > 0 && (
          <button
            onClick={handleCollect}
            disabled={collecting}
            className="px-4 py-2 rounded-lg bg-mc-error text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {collecting ? '收回中…' : `收回 ${selected.size} 張`}
          </button>
        )}
      </div>

      {/* Member groups */}
      <div className="space-y-3">
        {data.groups.map(group => {
          const isExpanded = expandedMember === group.memberId
          const memberSelectedCount = group.areas.filter(a => selected.has(a.id)).length
          const hasOldData = group.areas.some(a => !a.dispatchedAt) // no dispatch date = old sync data

          return (
            <div
              key={group.memberId}
              className="bg-mc-card rounded-xl border border-white/5 overflow-hidden"
            >
              {/* Member header */}
              <button
                onClick={() => setExpandedMember(isExpanded ? null : group.memberId)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-colors"
              >
                {/* Avatar circle */}
                <div className="w-10 h-10 rounded-full bg-mc-accent flex items-center justify-center text-sm font-bold text-mc-highlight flex-shrink-0">
                  {group.memberName.slice(0, 1)}
                </div>
                {/* Name + count */}
                <div className="flex-1 text-left">
                  <div className="text-mc-text font-medium">{group.memberName}</div>
                  <div className="text-xs text-mc-text/40">
                    {group.count} 張{hasOldData ? '（含歷史資料）' : ''}
                  </div>
                </div>
                {/* Count badge */}
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  group.count > 5 ? 'bg-orange-500/20 text-orange-400' : 'bg-mc-accent text-mc-highlight'
                }`}>
                  {group.count}
                </div>
                {/* Expand icon */}
                <svg className={`w-5 h-5 text-mc-text/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded areas */}
              {isExpanded && (
                <div className="border-t border-white/5">
                  {/* Select all (admin only) */}
                  {isAdmin && (
                    <div className="px-5 py-2 border-b border-white/5 flex items-center gap-2">
                      <button
                        onClick={() => selectAllForMember(group.memberId)}
                        className="text-xs text-mc-highlight hover:text-white transition-colors"
                      >
                        {memberSelectedCount === group.areas.length ? '取消全選' : '全選'}
                      </button>
                      {memberSelectedCount > 0 && (
                        <span className="text-xs text-mc-text/40">已選 {memberSelectedCount} 張</span>
                      )}
                    </div>
                  )}

                  <div className="divide-y divide-white/5">
                    {group.areas.map(area => {
                      const isSelected = selected.has(area.id)
                      return (
                        <div key={area.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02]">
                          {/* Checkbox (admin only) */}
                          {isAdmin && (
                            <button
                              onClick={() => toggleSelect(area.id)}
                              className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-mc-error border-mc-error text-white'
                                  : 'border-white/20 hover:border-white/40'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          )}

                          {/* Area info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-mc-text font-medium">
                                {area.blockCode || area.name}
                              </span>
                              <span className="text-xs text-mc-text/30">
                                {mapLabel(area.mapId)} #{area.mapAreaId}
                              </span>
                            </div>
                            {area.assignNote && (
                              <div className="text-xs text-mc-text/40 mt-0.5 truncate">{area.assignNote}</div>
                            )}
                          </div>

                          {/* Dispatch days */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs text-mc-text/40">分發</div>
                            <div className={`text-sm font-medium ${
                              area.dispatchedAt
                                ? (Date.now() - new Date(area.dispatchedAt).getTime() > 30 * 86400000
                                    ? 'text-orange-400'
                                    : 'text-mc-text/60')
                                : 'text-mc-text/20'
                            }`}>
                              {daysSince(area.dispatchedAt)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
