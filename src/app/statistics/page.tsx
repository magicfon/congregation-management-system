'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'


import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface Summary {
  totalAreas: number
  totalMembers: number
  activeMembers: number
  idleAreas: number
  totalSchedules: number
  completedSchedules: number
  cancelledSchedules: number
  pendingSchedules: number
  totalReports: number
  approvedReports: number
  pendingReports: number
  completionRate: number
  approvalRate: number
}

interface WeeklyData { week: string; scheduled: number; completed: number; cancelled: number }
interface MemberActivity { id: string; name: string; schedules: number; reports: number; total: number }
interface AreaActivity {
  id: string
  name: string
  assignedTo: string | null
  daysSinceActivity: number
  isIdle: boolean
  _count: { schedules: number; reports: number }
}

interface StatsData {
  summary: Summary
  weeklySchedules: WeeklyData[]
  memberActivity: MemberActivity[]
  areaActivity: AreaActivity[]
  idleAreas: AreaActivity[]
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  color: string
}) {
  return (
    <div className={`bg-mc-card border rounded-xl p-5 ${color}`}>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-mc-text/60 text-sm">{label}</div>
      {sub && <div className="text-xs mt-1 opacity-60">{sub}</div>}
    </div>
  )
}

function BarChart({
  data,
  maxValue,
  color,
  label,
}: {
  data: { label: string; value: number }[]
  maxValue: number
  color: string
  label: string
}) {
  if (data.length === 0) return <div className="text-mc-text/30 text-sm text-center py-8">無資料</div>

  return (
    <div>
      <div className="text-xs text-mc-text/40 mb-3">{label}</div>
      <div className="space-y-2">
        {data.map((item) => {
          const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0
          return (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-24 text-xs text-mc-text/50 text-right flex-shrink-0 truncate" title={item.label}>
                {item.label}
              </div>
              <div className="flex-1 h-5 bg-mc-accent rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${pct}%`, minWidth: item.value > 0 ? '4px' : '0' }}
                />
              </div>
              <div className="w-8 text-xs text-mc-text/60 text-right flex-shrink-0">{item.value}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProgressRing({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 40
  const circumference = 2 * Math.PI * r
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#ffffff10" strokeWidth="8" />
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-700 ${color}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-mc-text">{value}%</span>
        </div>
      </div>
      <div className="text-xs text-mc-text/50 text-center">{label}</div>
    </div>
  )
}

function IdleAreaWarnings({ areas }: { areas: AreaActivity[] }) {
  if (areas.length === 0) {
    return (
      <div className="flex items-center gap-3 py-6 justify-center text-mc-success text-sm">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        所有區域均在正常活動範圍內
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {areas.map((area) => (
        <div
          key={area.id}
          className="flex items-center justify-between py-3 px-4 rounded-lg bg-mc-warning/5 border border-mc-warning/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-mc-warning animate-pulse flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-mc-text">{area.name}</div>
              <div className="text-xs text-mc-text/40">
                {area.assignedTo ? `負責人：${area.assignedTo}` : '未分配負責人'}
                {' · '}
                {area._count.schedules} 排班 · {area._count.reports} 回報
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-semibold text-mc-warning">{area.daysSinceActivity} 天</div>
            <div className="text-xs text-mc-warning/60">未有活動</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function WeeklyChart({ data }: { data: WeeklyData[] }) {
  const maxVal = Math.max(...data.map((d) => d.scheduled + d.completed + d.cancelled), 1)

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 h-32 min-w-max px-1">
        {data.map((d) => {
          const total = d.scheduled + d.completed + d.cancelled
          const completedH = (d.completed / maxVal) * 100
          const scheduledH = (d.scheduled / maxVal) * 100
          const cancelledH = (d.cancelled / maxVal) * 100
          return (
            <div key={d.week} className="flex flex-col items-center gap-1 flex-1 min-w-[36px]">
              <div className="text-xs text-mc-text/30 font-mono">{total > 0 ? total : ''}</div>
              <div className="w-full flex flex-col justify-end gap-px" style={{ height: '96px' }}>
                {cancelledH > 0 && (
                  <div
                    className="w-full bg-mc-text/20 rounded-t"
                    style={{ height: `${cancelledH}%` }}
                    title={`已取消: ${d.cancelled}`}
                  />
                )}
                {scheduledH > 0 && (
                  <div
                    className="w-full bg-blue-500/60"
                    style={{ height: `${scheduledH}%` }}
                    title={`已排班: ${d.scheduled}`}
                  />
                )}
                {completedH > 0 && (
                  <div
                    className="w-full bg-mc-success/70 rounded-b"
                    style={{ height: `${completedH}%` }}
                    title={`已完成: ${d.completed}`}
                  />
                )}
                {total === 0 && (
                  <div className="w-full bg-white/5 rounded" style={{ height: '4px' }} />
                )}
              </div>
              <div className="text-xs text-mc-text/30 text-center leading-tight">{d.week}</div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-3 justify-center text-xs text-mc-text/40">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-mc-success/70 inline-block" /> 已完成</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500/60 inline-block" /> 已排班</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white/20 inline-block" /> 已取消</span>
      </div>
    </div>
  )
}

export default function StatisticsPage() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/statistics')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-mc-text/30 text-sm">載入統計資料中…</div>
        </div>
      </DashboardLayout>
    )
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-mc-error text-sm">無法載入統計資料</div>
        </div>
      </DashboardLayout>
    )
  }

  const { summary } = data

  const topMembers = [...data.memberActivity]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
  const maxMemberActivity = Math.max(...topMembers.map((m) => m.total), 1)

  const topAreas = [...data.areaActivity]
    .sort((a, b) => (b._count.schedules + b._count.reports) - (a._count.schedules + a._count.reports))
    .slice(0, 8)
  const maxAreaActivity = Math.max(...topAreas.map((a) => a._count.schedules + a._count.reports), 1)

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-mc-text">統計報表</h1>
          <p className="text-mc-text/50 text-sm mt-1">服務數據分析與視覺化</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="區域總數" value={summary.totalAreas} sub={`${summary.idleAreas} 個閒置`} color={summary.idleAreas > 0 ? 'border-mc-warning/20 text-mc-warning' : 'border-mc-success/20 text-mc-success'} />
          <StatCard label="活躍成員" value={summary.activeMembers} sub={`共 ${summary.totalMembers} 位`} color="border-blue-500/20 text-blue-400" />
          <StatCard label="排班完成率" value={`${summary.completionRate}%`} sub={`${summary.completedSchedules} / ${summary.totalSchedules} 筆`} color="border-purple-500/20 text-purple-400" />
          <StatCard label="待審回報" value={summary.pendingReports} sub={`共 ${summary.totalReports} 筆`} color={summary.pendingReports > 0 ? 'border-mc-warning/20 text-mc-warning' : 'border-white/10 text-mc-text'} />
        </div>

        {/* Idle area warnings */}
        {summary.idleAreas > 0 && (
          <div className="bg-mc-card border border-mc-warning/20 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-mc-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-base font-semibold text-mc-warning">
                閒置區域警告 ({summary.idleAreas} 個)
              </h2>
            </div>
            <IdleAreaWarnings areas={data.idleAreas} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Completion rates */}
          <div className="bg-mc-card border border-white/5 rounded-xl p-6">
            <h2 className="text-base font-semibold text-mc-text mb-5">完成率概覽</h2>
            <div className="flex justify-around">
              <ProgressRing value={summary.completionRate} label="排班完成率" color="text-mc-success" />
              <ProgressRing value={summary.approvalRate} label="回報核准率" color="text-blue-400" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="bg-mc-accent/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-mc-warning">{summary.cancelledSchedules}</div>
                <div className="text-xs text-mc-text/40">取消排班</div>
              </div>
              <div className="bg-mc-accent/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-mc-success">{summary.approvedReports}</div>
                <div className="text-xs text-mc-text/40">核准回報</div>
              </div>
            </div>
          </div>

          {/* Member activity */}
          <div className="bg-mc-card border border-white/5 rounded-xl p-6">
            <h2 className="text-base font-semibold text-mc-text mb-5">成員活躍度</h2>
            <BarChart
              data={topMembers.map((m) => ({ label: m.name, value: m.total }))}
              maxValue={maxMemberActivity}
              color="bg-blue-500/60"
              label="排班 + 回報總次數"
            />
          </div>

          {/* Area activity */}
          <div className="bg-mc-card border border-white/5 rounded-xl p-6">
            <h2 className="text-base font-semibold text-mc-text mb-5">區域活動量</h2>
            <BarChart
              data={topAreas.map((a) => ({ label: a.name, value: a._count.schedules + a._count.reports }))}
              maxValue={maxAreaActivity}
              color="bg-purple-500/60"
              label="排班 + 回報總次數"
            />
          </div>
        </div>

        {/* Weekly chart */}
        <div className="bg-mc-card border border-white/5 rounded-xl p-6">
          <h2 className="text-base font-semibold text-mc-text mb-5">近 12 週排班趨勢</h2>
          <WeeklyChart data={data.weeklySchedules} />
        </div>

        {/* All areas idle status table */}
        <div className="bg-mc-card border border-white/5 rounded-xl p-6 mt-6">
          <h2 className="text-base font-semibold text-mc-text mb-5">區域活動狀況</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left pb-3 text-xs font-medium text-mc-text/50 uppercase tracking-wider">區域</th>
                  <th className="text-left pb-3 text-xs font-medium text-mc-text/50 uppercase tracking-wider hidden md:table-cell">負責人</th>
                  <th className="text-center pb-3 text-xs font-medium text-mc-text/50 uppercase tracking-wider">排班</th>
                  <th className="text-center pb-3 text-xs font-medium text-mc-text/50 uppercase tracking-wider">回報</th>
                  <th className="text-right pb-3 text-xs font-medium text-mc-text/50 uppercase tracking-wider">最後活動</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.areaActivity.map((area) => (
                  <tr key={area.id} className="hover:bg-mc-accent/20 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${area.isIdle ? 'bg-mc-warning' : 'bg-mc-success'}`} />
                        <span className="text-sm text-mc-text">{area.name}</span>
                      </div>
                    </td>
                    <td className="py-3 hidden md:table-cell">
                      <span className="text-sm text-mc-text/50">{area.assignedTo ?? '—'}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-sm text-mc-text/60">{area._count.schedules}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-sm text-mc-text/60">{area._count.reports}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className={`text-sm ${area.isIdle ? 'text-mc-warning font-medium' : 'text-mc-text/50'}`}>
                        {area.daysSinceActivity === 0 ? '今天' : `${area.daysSinceActivity} 天前`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
