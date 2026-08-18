'use client'

import { useState, useEffect, useCallback } from 'react'

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

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

/** 天數 → 提醒等級 */
function urgency(days: number | null): { label: string; cls: string } {
  if (days === null) return { label: '未記錄', cls: 'text-mc-text-secondary' }
  if (days >= 60) return { label: `${days} 天 ⚠️`, cls: 'text-mc-error font-semibold' }
  if (days >= 30) return { label: `${days} 天 🔶`, cls: 'text-yellow-400' }
  return { label: `${days} 天`, cls: 'text-mc-text-secondary' }
}

export default function ActiveAssignmentsPage() {
  const [groups, setGroups] = useState<MemberGroup[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

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

  const toggle = (mid: string) => setCollapsed((c) => ({ ...c, [mid]: !c[mid] }))

  return (
    <div className="space-y-6">
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
          className="px-3 py-1.5 text-sm rounded-lg bg-mc-card border border-white/10 text-mc-text hover:border-mc-accent/50 transition-colors"
        >
          重新載入
        </button>
      </div>

      {/* 統計摘要 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="mc-card rounded-xl p-4">
          <div className="text-2xl font-bold text-mc-highlight">{total}</div>
          <div className="text-xs text-mc-text-secondary mt-1">使用中地圖</div>
        </div>
        <div className="mc-card rounded-xl p-4">
          <div className="text-2xl font-bold text-mc-highlight">{groups.length}</div>
          <div className="text-xs text-mc-text-secondary mt-1">負責人員</div>
        </div>
        <div className="mc-card rounded-xl p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {groups.reduce((n, g) => n + g.areas.filter((a) => {
              const d = daysSince(a.dispatchedAt)
              return d !== null && d >= 30 && d < 60
            }).length, 0)}
          </div>
          <div className="text-xs text-mc-text-secondary mt-1">超過 30 天</div>
        </div>
        <div className="mc-card rounded-xl p-4">
          <div className="text-2xl font-bold text-mc-error">
            {groups.reduce((n, g) => n + g.areas.filter((a) => {
              const d = daysSince(a.dispatchedAt)
              return d !== null && d >= 60
            }).length, 0)}
          </div>
          <div className="text-xs text-mc-text-secondary mt-1">超過 60 天</div>
        </div>
      </div>

      {error && (
        <div className="mc-card rounded-xl p-4 text-mc-error text-sm">載入失敗：{error}</div>
      )}

      {loading && (
        <div className="mc-card rounded-xl p-8 text-center text-mc-text-secondary">載入中…</div>
      )}

      {/* 按人員分組 */}
      {!loading && groups.map((g) => {
        const worst = Math.max(...g.areas.map((a) => daysSince(a.dispatchedAt) ?? -1), -1)
        return (
          <div key={g.memberId} className="mc-card rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(g.memberId)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-mc-text">{g.memberName}</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-mc-accent/20 text-mc-highlight border border-mc-accent/40">
                  {g.count} 張
                </span>
                {worst >= 60 && <span className="text-xs text-mc-error">最久 {worst} 天 ⚠️</span>}
                {worst >= 30 && worst < 60 && <span className="text-xs text-yellow-400">最久 {worst} 天</span>}
              </div>
              <span className={`text-mc-text-secondary transition-transform ${collapsed[g.memberId] ? '' : 'rotate-180'}`}>
                ▾
              </span>
            </button>
            {!collapsed[g.memberId] && (
              <div className="border-t border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-mc-text-secondary border-b border-white/10">
                      <th className="px-5 py-2 font-normal">區域</th>
                      <th className="px-3 py-2 font-normal">地圖</th>
                      <th className="px-3 py-2 font-normal">分發日</th>
                      <th className="px-3 py-2 font-normal">經過時間</th>
                      <th className="px-3 py-2 font-normal">備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.areas.map((a) => {
                      const days = daysSince(a.dispatchedAt)
                      const u = urgency(days)
                      return (
                        <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-5 py-2.5 text-mc-text font-medium">{a.blockCode || a.name}</td>
                          <td className="px-3 py-2.5 text-mc-text-secondary">
                            {a.mapId ? MAP_LABEL[a.mapId] : '—'}
                            {a.mapAreaId ? ` · ${a.mapAreaId}` : ''}
                          </td>
                          <td className="px-3 py-2.5 text-mc-text-secondary">{fmtDate(a.dispatchedAt)}</td>
                          <td className={`px-3 py-2.5 ${u.cls}`}>{u.label}</td>
                          <td className="px-3 py-2.5 text-mc-text-secondary truncate max-w-[200px]">
                            {a.assignNote || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {!loading && groups.length === 0 && !error && (
        <div className="mc-card rounded-xl p-8 text-center text-mc-text-secondary">
          目前沒有使用中的地圖 🎉
        </div>
      )}

      <div className="mc-card rounded-xl p-4 text-sm text-mc-text-secondary">
        💡 之後會將此清單定期推送到 LINE 群組，提醒負責人手上還有地圖未完成或未回報。
      </div>
    </div>
  )
}
