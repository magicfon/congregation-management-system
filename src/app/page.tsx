'use client'

import { useState, useEffect } from 'react'
import { Territory, Schedule, Report } from '@/types'

export default function Dashboard() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
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
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg shimmer" />
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-lg shimmer" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-5">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Total Territories"
          value={territories.length}
          icon={<MapIcon />}
          color="blue"
        />
        <MetricCard
          label="Active"
          value={activeCount}
          total={territories.length}
          subtitle={`${Math.round((activeCount / territories.length) * 100)}% active`}
          icon={<CheckIcon />}
          color="green"
        />
        <MetricCard
          label="Idle"
          value={idleCount}
          subtitle="Need attention"
          icon={<WarningIcon />}
          color="red"
        />
        <MetricCard
          label="Schedules"
          value={schedules.length}
          icon={<CalendarIcon />}
          color="purple"
        />
      </div>

      {/* Idle Warning */}
      {stats?.idleTerritories && stats.idleTerritories.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-200">Idle Territories Warning</h3>
              <p className="text-xs text-amber-300/80 mt-1">
                {stats.idleTerritories.length} territories have been idle for over 30 days
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {stats.idleTerritories.slice(0, 5).map((t: any) => (
                  <span key={t.code} className="px-1.5 py-0.5 rounded text-2xs font-mono-tight bg-amber-500/20 text-amber-200">
                    {t.code}: {t.days_idle}d
                  </span>
                ))}
              </div>
            </div>
            <button className="text-xs text-amber-300 hover:text-amber-100 transition-colors">
              View all →
            </button>
          </div>
        </div>
      )}

      {/* Three-column layout */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Territories */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-sm font-semibold text-foreground">Territories</h3>
            <span className="text-2xs text-muted-foreground">{territories.length} total</span>
          </div>
          <div className="panel-body space-y-2">
            {territories.slice(0, 5).map((territory) => (
              <TerritoryRow key={territory.id} territory={territory} />
            ))}
            {territories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No territories</p>
            )}
          </div>
        </div>

        {/* Middle: Schedules + Quick Actions */}
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-sm font-semibold text-foreground">Schedules</h3>
            </div>
            <div className="panel-body space-y-2">
              {schedules.filter(s => s.is_active).slice(0, 4).map((schedule) => (
                <ScheduleRow key={schedule.id} schedule={schedule} />
              ))}
              {schedules.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No schedules</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
            </div>
            <div className="panel-body grid grid-cols-2 gap-2">
              <QuickAction label="Add Territory" desc="Create new" />
              <QuickAction label="New Report" desc="Log activity" />
              <QuickAction label="Schedule" desc="Manage shifts" />
              <QuickAction label="Export" desc="Download data" />
            </div>
          </div>
        </div>

        {/* Statistics & Recent Reports */}
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-sm font-semibold text-foreground">Statistics</h3>
              <span className="text-2xs text-muted-foreground">This month</span>
            </div>
            <div className="panel-body space-y-3">
              <StatRow label="Avg. days idle" value={Math.round(territories.reduce((sum, t) => sum + (t.days_idle || 0), 0) / Math.max(territories.length, 1))} />
              <StatRow label="Completion rate" value={`${Math.round((completedCount / Math.max(territories.length, 1)) * 100)}%`} />
              <StatRow label="Reports this week" value={reports.length} />
              <div className="pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-2">Status breakdown</div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status="active" count={activeCount} />
                  <StatusBadge status="idle" count={idleCount} />
                  <StatusBadge status="completed" count={completedCount} />
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3 className="text-sm font-semibold text-foreground">Recent Reports</h3>
            </div>
            <div className="panel-body space-y-2">
              {reports.slice(0, 3).map((report) => (
                <ReportRow key={report.id} report={report} />
              ))}
              {reports.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No reports</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function MetricCard({ label, value, total, subtitle, icon, color }: {
  label: string
  value: number | string
  total?: number
  subtitle?: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'purple' | 'red'
}) {
  const colorMap = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/20', icon: 'text-green-400' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400' },
  }

  return (
    <div className={`rounded-lg border p-3.5 ${colorMap[color].bg} ${colorMap[color].border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={`w-5 h-5 opacity-60 ${colorMap[color].icon}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold font-mono-tight">{value}</span>
        {total !== undefined && (
          <span className="text-sm text-muted-foreground font-mono-tight">/{total}</span>
        )}
      </div>
      {subtitle && (
        <div className="text-2xs text-muted-foreground font-mono-tight mt-0.5">{subtitle}</div>
      )}
    </div>
  )
}

function TerritoryRow({ territory }: { territory: Territory }) {
  const statusConfig = {
    active: { label: 'Active', color: 'badge-success', dot: 'bg-green-400' },
    idle: { label: 'Idle', color: 'badge-warning', dot: 'bg-amber-400' },
    completed: { label: 'Done', color: 'badge-neutral', dot: 'bg-muted-foreground' }
  }
  const config = statusConfig[territory.status as keyof typeof statusConfig] || statusConfig.active

  return (
    <div className="flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-secondary/50 transition-colors cursor-pointer">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
          <span className="text-2xs font-medium font-mono-tight">{territory.code}</span>
        </div>
        <div>
          <p className="text-xs font-medium">{territory.responsible_brother || 'Unassigned'}</p>
          <p className="text-2xs text-muted-foreground">{territory.days_idle || 0} days idle</p>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium ${config.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    </div>
  )
}

function ScheduleRow({ schedule }: { schedule: Schedule }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-secondary/50 transition-colors cursor-pointer">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
          <span className="text-2xs">📅</span>
        </div>
        <div>
          <p className="text-xs font-medium">{schedule.time_slot}</p>
          <p className="text-2xs text-muted-foreground">{schedule.group_name || 'No group'}</p>
        </div>
      </div>
      <span className="text-2xs text-muted-foreground">{schedule.leader || '-'}</span>
    </div>
  )
}

function ReportRow({ report }: { report: Report }) {
  return (
    <div className="flex items-start gap-2 text-xs py-2 px-3 -mx-3 rounded hover:bg-secondary/50 transition-colors cursor-pointer">
      <span className="text-sm">📝</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{report.publisher_name}</p>
        <p className="text-2xs text-muted-foreground truncate">{report.notes || 'No notes'}</p>
      </div>
      <span className="text-2xs text-muted-foreground whitespace-nowrap">
        {new Date(report.timestamp).toLocaleDateString()}
      </span>
    </div>
  )
}

function QuickAction({ label, desc }: { label: string; desc: string }) {
  return (
    <button className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-left group">
      <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
        <div className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors">+</div>
      </div>
      <div className="min-w-0">
        <div className="text-2xs font-medium truncate">{label}</div>
        <div className="text-2xs text-muted-foreground truncate">{desc}</div>
      </div>
    </button>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium font-mono-tight">{value}</span>
    </div>
  )
}

function StatusBadge({ status, count }: { status: string; count: number }) {
  const config = {
    active: { color: 'bg-green-500', label: 'active' },
    idle: { color: 'bg-amber-500', label: 'idle' },
    completed: { color: 'bg-muted-foreground', label: 'done' }
  }
  const c = config[status as keyof typeof config] || config.active

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono-tight bg-secondary text-muted-foreground">
      <span className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
      {c.label}: {count}
    </span>
  )
}

// --- Icons ---

function MapIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1l6 5v7a1 1 0 01-1 1H3a1 1 0 01-1-1V6l6-5z" /></svg>
}

function CheckIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8l3 3 7-7" /></svg>
}

function WarningIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1l7 13H1L8 1zM8 6v3M8 11.5v.5" /></svg>
}

function CalendarIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="1" /><path d="M2 6h12M5 1v2M11 1v2" /></svg>
}
