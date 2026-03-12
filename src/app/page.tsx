'use client'

import { useState, useEffect } from 'react'
import { Territory, Schedule, Report } from '@/types'

export default function Dashboard() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(60)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setAutoRefreshCountdown((prev) => {
        if (prev <= 1) {
          loadData()
          return 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  async function loadData() {
    try {
      const [territoriesRes, schedulesRes, reportsRes, statsRes] = await Promise.all([
        fetch('/api/territories'),
        fetch('/api/schedules'),
        fetch('/api/reports'),
        fetch('/api/stats?type=overview')
      ])
      
      const territoriesData = await territoriesRes.json()
      const schedulesData = await schedulesRes.json()
      const reportsData = await reportsRes.json()
      const statsData = await statsRes.json()
      
      setTerritories(territoriesData.territories || [])
      setSchedules(schedulesData.schedules || [])
      setReports(reportsData.reports || [])
      setStats(statsData)
      setLastUpdate(new Date())
      setAutoRefreshCountdown(60)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeCount = territories.filter(t => t.status === 'active').length
  const idleCount = territories.filter(t => t.status === 'idle').length
  const completedCount = territories.filter(t => t.status === 'completed').length

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-[#AAAAAA]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#2196F3]">會眾管理系統</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-sm text-[#AAAAAA]">Disconnected</span>
          </div>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-[#1976D2] hover:bg-[#1565C0] rounded-lg text-sm font-medium transition-colors"
          >
            刷新
          </button>
        </div>
      </div>

      {/* Metric Cards - 2x2 Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<TerritoryIcon />}
          title="TOTAL TERRITORIES"
          value={territories.length}
          color="blue"
        />
        <MetricCard
          icon={<ActiveIcon />}
          title="ACTIVE"
          value={activeCount}
          subtitle={`${Math.round((activeCount / Math.max(territories.length, 1)) * 100)}%`}
          color="green"
        />
        <MetricCard
          icon={<WarningIcon />}
          title="IDLE"
          value={idleCount}
          color="orange"
        />
        <MetricCard
          icon={<ScheduleIcon />}
          title="SCHEDULES"
          value={schedules.length}
          color="purple"
        />
      </div>

      {/* Idle Warning */}
      {stats?.idleTerritories && stats.idleTerritories.length > 0 && (
        <div className="mb-6 p-4 bg-[#FF5252]/10 border border-[#FF5252]/20 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-[#FF5252]">閒置地區警告</h3>
              <p className="text-xs text-[#AAAAAA] mt-1">
                {stats.idleTerritories.length} 個地區已閒置超過 30 天
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {stats.idleTerritories.slice(0, 5).map((t: any) => (
                  <span key={t.code} className="px-2 py-1 bg-[#1E1E1E] rounded text-xs font-mono">
                    {t.code}: {t.days_idle}d
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Sections */}
      <div className="space-y-6">
        {/* Territories Section */}
        <DataSection title="地區列表">
          {territories.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {territories.slice(0, 5).map((territory) => (
                <TerritoryRow key={territory.id} territory={territory} />
              ))}
            </div>
          )}
        </DataSection>

        {/* Schedules Section */}
        <DataSection title="排程列表">
          {schedules.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {schedules.filter(s => s.is_active).slice(0, 4).map((schedule) => (
                <ScheduleRow key={schedule.id} schedule={schedule} />
              ))}
            </div>
          )}
        </DataSection>

        {/* Reports Section */}
        <DataSection title="近期報告">
          {reports.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {reports.slice(0, 5).map((report) => (
                <ReportRow key={report.id} report={report} />
              ))}
            </div>
          )}
        </DataSection>

        {/* Statistics Section */}
        <DataSection title="統計數據">
          <div className="grid grid-cols-2 gap-4">
            <StatItem label="平均閒置天數" value={Math.round(territories.reduce((sum, t) => sum + (t.days_idle || 0), 0) / Math.max(territories.length, 1))} />
            <StatItem label="完成率" value={`${Math.round((completedCount / Math.max(territories.length, 1)) * 100)}%`} />
            <StatItem label="本週報告" value={reports.length} />
            <StatItem label="活躍傳道員" value={8} />
          </div>
          <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
            <div className="text-xs text-[#AAAAAA] mb-2">狀態分佈</div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge color="green" label="活躍" count={activeCount} />
              <StatusBadge color="orange" label="閒置" count={idleCount} />
              <StatusBadge color="gray" label="完成" count={completedCount} />
            </div>
          </div>
        </DataSection>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-[#2A2A2A] flex items-center justify-between text-xs text-[#AAAAAA]">
        <span>最後更新: {lastUpdate.toLocaleString('zh-TW')}</span>
        <span>Auto-refresh in {autoRefreshCountdown}s</span>
      </div>
    </div>
  )
}

// --- Components ---

function MetricCard({ icon, title, value, subtitle, color }: {
  icon: React.ReactNode
  title: string
  value: number
  subtitle?: string
  color: 'blue' | 'green' | 'orange' | 'purple'
}) {
  const colors = {
    blue: 'text-[#2196F3]',
    green: 'text-[#4CAF50]',
    orange: 'text-[#FF9800]',
    purple: 'text-[#9C27B0]',
  }

  return (
    <div className="bg-[#1E1E1E] rounded-lg p-5">
      <div className={`w-10 h-10 mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <div className="text-xs text-[#AAAAAA] mb-1 tracking-wide">{title}</div>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${colors[color]}`}>{value}</span>
        {subtitle && <span className="text-xs text-[#AAAAAA]">{subtitle}</span>}
      </div>
    </div>
  )
}

function DataSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1E1E1E] rounded-lg">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2A2A]">
        <div className="w-1 h-5 bg-[#2196F3] rounded-full"></div>
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-[#AAAAAA] text-sm">
      無數據
    </div>
  )
}

function TerritoryRow({ territory }: { territory: Territory }) {
  const statusColors = {
    active: { bg: 'bg-[#4CAF50]/20', text: 'text-[#4CAF50]', label: '活躍' },
    idle: { bg: 'bg-[#FF9800]/20', text: 'text-[#FF9800]', label: '閒置' },
    completed: { bg: 'bg-[#757575]/20', text: 'text-[#757575]', label: '完成' },
  }
  const config = statusColors[territory.status as keyof typeof statusColors] || statusColors.active

  return (
    <div className="flex items-center justify-between p-3 bg-[#252525] rounded-lg hover:bg-[#2A2A2A] transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#1E1E1E] rounded flex items-center justify-center">
          <span className="text-sm font-mono">{territory.code}</span>
        </div>
        <div>
          <div className="text-sm font-medium">{territory.responsible_brother || '未分配'}</div>
          <div className="text-xs text-[#AAAAAA]">閒置 {territory.days_idle || 0} 天</div>
        </div>
      </div>
      <span className={`px-2 py-1 rounded text-xs ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    </div>
  )
}

function ScheduleRow({ schedule }: { schedule: Schedule }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#252525] rounded-lg hover:bg-[#2A2A2A] transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#1E1E1E] rounded flex items-center justify-center text-lg">
          📅
        </div>
        <div>
          <div className="text-sm font-medium">{schedule.time_slot}</div>
          <div className="text-xs text-[#AAAAAA]">{schedule.group_name || '無組別'}</div>
        </div>
      </div>
      <div className="text-xs text-[#AAAAAA]">{schedule.leader || '-'}</div>
    </div>
  )
}

function ReportRow({ report }: { report: Report }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-[#252525] rounded-lg hover:bg-[#2A2A2A] transition-colors cursor-pointer">
      <div className="text-lg">📝</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{report.publisher_name}</div>
        <div className="text-xs text-[#AAAAAA] truncate">{report.notes || '無筆記'}</div>
      </div>
      <div className="text-xs text-[#AAAAAA] whitespace-nowrap">
        {new Date(report.timestamp).toLocaleDateString('zh-TW')}
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#252525] rounded-lg">
      <span className="text-xs text-[#AAAAAA]">{label}</span>
      <span className="text-sm font-medium font-mono">{value}</span>
    </div>
  )
}

function StatusBadge({ color, label, count }: { color: string; label: string; count: number }) {
  const colors: Record<string, string> = {
    green: 'bg-[#4CAF50]',
    orange: 'bg-[#FF9800]',
    gray: 'bg-[#757575]',
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#252525] rounded-full text-xs">
      <span className={`w-2 h-2 rounded-full ${colors[color]}`}></span>
      <span className="text-[#AAAAAA]">{label}:</span>
      <span className="font-mono">{count}</span>
    </div>
  )
}

// --- Icons ---

function TerritoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  )
}

function ActiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  )
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
    </svg>
  )
}
