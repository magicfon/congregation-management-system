'use client'

import { useState, useEffect } from 'react'
import { Territory, Schedule } from '@/types'

export default function Dashboard() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [territoriesRes, schedulesRes, statsRes] = await Promise.all([
        fetch('/api/territories'),
        fetch('/api/schedules'),
        fetch('/api/stats?type=overview')
      ])
      
      const territoriesData = await territoriesRes.json()
      const schedulesData = await schedulesRes.json()
      const statsData = await statsRes.json()
      
      setTerritories(territoriesData.territories || [])
      setSchedules(schedulesData.schedules || [])
      setStats(statsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeCount = territories.filter(t => t.status === 'active').length
  const idleCount = territories.filter(t => t.status === 'idle').length

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Nav Rail */}
      <nav className="flex flex-col bg-card border-r border-border shrink-0 w-14">
        <div className="flex flex-col items-center py-3 gap-2 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">CM</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col py-2 gap-0.5 px-2">
          <NavButton 
            icon={<OverviewIcon />} 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
          />
          <NavButton 
            icon={<TerritoryIcon />} 
            active={activeTab === 'territories'} 
            onClick={() => setActiveTab('territories')}
          />
          <NavButton 
            icon={<ScheduleIcon />} 
            active={activeTab === 'schedules'} 
            onClick={() => setActiveTab('schedules')}
          />
          <NavButton 
            icon={<ReportIcon />} 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
          />
        </div>

        <div className="flex flex-col items-center py-3 gap-2 border-t border-border">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse-dot" />
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border bg-card/50">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">Overview</h1>
              <span className="text-2xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">v1.0.0</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Territory
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-5 space-y-5">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Metric Cards */}
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
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-orange-200">Idle Territories Warning</h3>
                      <p className="text-xs text-orange-300/80 mt-1">
                        {stats.idleTerritories.length} territories have been idle for over 30 days
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {stats.idleTerritories.slice(0, 5).map((t: any) => (
                          <span key={t.code} className="px-1.5 py-0.5 rounded text-2xs font-mono-tight bg-orange-500/20 text-orange-200">
                            {t.code}: {t.days_idle}d
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="text-xs text-orange-300 hover:text-orange-100 transition-colors">
                      View all →
                    </button>
                  </div>
                </div>
              )}

              {/* Three Column Layout */}
              <div className="grid lg:grid-cols-3 gap-4">
                {/* Recent Territories */}
                <div className="panel">
                  <div className="panel-header">
                    <h3 className="text-sm font-semibold">Recent Territories</h3>
                    <span className="text-2xs text-muted-foreground">{territories.length} total</span>
                  </div>
                  <div className="panel-body space-y-2">
                    {territories.slice(0, 5).map((territory) => (
                      <TerritoryRow key={territory.id} territory={territory} />
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                  <div className="panel">
                    <div className="panel-header">
                      <h3 className="text-sm font-semibold">Quick Actions</h3>
                    </div>
                    <div className="panel-body grid grid-cols-2 gap-2">
                      <QuickAction label="Add Territory" desc="Create new" icon={<PlusIcon />} />
                      <QuickAction label="New Report" desc="Log activity" icon={<DocIcon />} />
                      <QuickAction label="Schedule" desc="Manage shifts" icon={<CalendarIcon />} />
                      <QuickAction label="Export" desc="Download data" icon={<ExportIcon />} />
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-header">
                      <h3 className="text-sm font-semibold">Recent Activity</h3>
                    </div>
                    <div className="panel-body space-y-3">
                      <ActivityRow icon="📝" title="Report submitted" desc="Territory A-1" time="2h ago" />
                      <ActivityRow icon="🗺️" title="Territory created" desc="D-3" time="5h ago" />
                      <ActivityRow icon="⚠️" title="Status changed" desc="B-2 → Idle" time="1d ago" />
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="panel">
                  <div className="panel-header">
                    <h3 className="text-sm font-semibold">Statistics</h3>
                    <span className="text-2xs text-muted-foreground">This month</span>
                  </div>
                  <div className="panel-body space-y-3">
                    <StatRow label="Avg. days idle" value={Math.round(territories.reduce((sum, t) => sum + (t.days_idle || 0), 0) / territories.length)} />
                    <StatRow label="Completion rate" value="78%" />
                    <StatRow label="Reports this week" value={12} />
                    <StatRow label="Active publishers" value={8} />
                    <div className="pt-2 border-t border-border/50">
                      <div className="text-xs text-muted-foreground mb-2">Status breakdown</div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono-tight bg-secondary text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          active: {activeCount}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono-tight bg-secondary text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          idle: {idleCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

// --- Sub-components ---

function NavButton({ icon, active, onClick }: { icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-smooth ${
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      <div className="w-5 h-5">{icon}</div>
    </button>
  )
}

function MetricCard({ label, value, subtitle, icon, color }: {
  label: string
  value: number | string
  subtitle?: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'purple' | 'red'
}) {
  const colorMap = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
  }

  const iconColorMap = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    red: 'text-red-400',
  }

  return (
    <div className={`rounded-lg border p-3.5 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <div className={`w-5 h-5 opacity-60 ${iconColorMap[color]}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold font-mono-tight">{value}</span>
      </div>
      {subtitle && (
        <div className="text-2xs opacity-50 font-mono-tight mt-0.5">{subtitle}</div>
      )}
    </div>
  )
}

function TerritoryRow({ territory }: { territory: Territory }) {
  const statusConfig = {
    active: { label: 'Active', color: 'bg-green-500/20 text-green-400', dot: 'bg-green-500' },
    idle: { label: 'Idle', color: 'bg-orange-500/20 text-orange-400', dot: 'bg-orange-500' },
    completed: { label: 'Done', color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' }
  }
  const config = statusConfig[territory.status as keyof typeof statusConfig] || statusConfig.active

  return (
    <div className="flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-secondary/50 transition-colors cursor-pointer">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
          <span className="text-2xs font-medium">{territory.code}</span>
        </div>
        <div>
          <p className="text-xs font-medium">{territory.responsible_brother || 'Unassigned'}</p>
          <p className="text-2xs text-muted-foreground">{territory.days_idle} days idle</p>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium ${config.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    </div>
  )
}

function QuickAction({ label, desc, icon }: { label: string; desc: string; icon: React.ReactNode }) {
  return (
    <button className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-left group">
      <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
        <div className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors">{icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-2xs font-medium truncate">{label}</div>
        <div className="text-2xs text-muted-foreground truncate">{desc}</div>
      </div>
    </button>
  )
}

function ActivityRow({ icon, title, desc, time }: { icon: string; title: string; desc: string; time: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-sm">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-2xs text-muted-foreground truncate">{desc}</p>
      </div>
      <span className="text-2xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
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

// --- Icons ---

function OverviewIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
}

function TerritoryIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1l6 5v7a1 1 0 01-1 1H3a1 1 0 01-1-1V6l6-5z" /></svg>
}

function ScheduleIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6.5" /><path d="M8 4v4l2.5 2.5" /></svg>
}

function ReportIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M5 5h6M5 8h6M5 11h3" /></svg>
}

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

function PlusIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
}

function DocIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M5 5h6M5 8h6M5 11h3" /></svg>
}

function ExportIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1M4 5l4-4 4 4M8 1v10" /></svg>
}
