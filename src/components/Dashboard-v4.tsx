'use client'

import { useState, useEffect } from 'react'
import { Territory, Schedule } from '@/types'

export default function DashboardV4() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'territories' | 'schedules' | 'reports'>('overview')

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
      {/* Left Sidebar - Icon Rail */}
      <nav className="flex flex-col bg-card border-r border-border shrink-0 transition-all duration-200 ease-in-out w-14">
        {/* Logo */}
        <div className="flex flex-col items-center py-3 gap-2 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">CM</span>
          </div>
        </div>

        {/* Nav Items */}
        <div className="flex-1 flex flex-col py-2 gap-0.5 px-2">
          <NavButton 
            icon={<OverviewIcon />} 
            label="Overview" 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
          />
          <NavButton 
            icon={<TerritoryIcon />} 
            label="Territories" 
            active={activeTab === 'territories'} 
            onClick={() => setActiveTab('territories')}
          />
          <NavButton 
            icon={<ScheduleIcon />} 
            label="Schedules" 
            active={activeTab === 'schedules'} 
            onClick={() => setActiveTab('schedules')}
          />
          <NavButton 
            icon={<ReportIcon />} 
            label="Reports" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
          />
        </div>

        {/* Bottom */}
        <div className="flex flex-col items-center py-3 gap-2 border-t border-border">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" title="System OK" />
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border bg-card/50">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold">
                {activeTab === 'overview' && 'Overview'}
                {activeTab === 'territories' && 'Territories'}
                {activeTab === 'schedules' && 'Schedules'}
                {activeTab === 'reports' && 'Reports'}
              </h1>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">v1.0.0</span>
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
        <main className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewContent 
                  territories={territories} 
                  schedules={schedules} 
                  stats={stats}
                  activeCount={activeCount}
                  idleCount={idleCount}
                />
              )}
              {activeTab === 'territories' && (
                <TerritoriesContent territories={territories} />
              )}
              {activeTab === 'schedules' && (
                <SchedulesContent schedules={schedules} />
              )}
              {activeTab === 'reports' && (
                <ReportsContent />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

// Nav Button Component
function NavButton({ icon, label, active, onClick }: { 
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-smooth group relative ${
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
      title={label}
    >
      <div className="w-5 h-5">{icon}</div>
      {active && (
        <span className="absolute left-0 w-0.5 h-5 bg-primary rounded-r" />
      )}
    </button>
  )
}

// Overview Content
function OverviewContent({ territories, schedules, stats, activeCount, idleCount }: {
  territories: Territory[]
  schedules: Schedule[]
  stats: any
  activeCount: number
  idleCount: number
}) {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Territories" value={territories.length} icon="🗺️" />
        <StatCard label="Active" value={activeCount} icon="✅" color="green" />
        <StatCard label="Idle" value={idleCount} icon="⚠️" color="orange" />
        <StatCard label="Schedules" value={schedules.length} icon="📅" />
      </div>

      {/* Idle Warning */}
      {stats?.idleTerritories && stats.idleTerritories.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h3 className="font-medium text-orange-200">Idle Territories Warning</h3>
              <p className="text-sm text-orange-300/80 mt-1">
                {stats.idleTerritories.length} territories have been idle for over 30 days
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {stats.idleTerritories.slice(0, 5).map((t: any) => (
                  <span key={t.code} className="px-2 py-1 bg-orange-500/20 text-orange-200 rounded text-xs">
                    {t.code} ({t.days_idle}d)
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Territories */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-medium">Recent Territories</h3>
          </div>
          <div className="divide-y divide-border">
            {territories.slice(0, 5).map((territory) => (
              <TerritoryRow key={territory.id} territory={territory} />
            ))}
          </div>
        </div>

        {/* Quick Actions & Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-medium mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickActionButton icon="➕" label="Add Territory" />
              <QuickActionButton icon="📝" label="New Report" />
              <QuickActionButton icon="📅" label="Schedule" />
              <QuickActionButton icon="📊" label="Export" />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-medium mb-3">Recent Activity</h3>
            <div className="space-y-3">
              <ActivityRow icon="📝" title="Report submitted" desc="Territory A-1" time="2h ago" />
              <ActivityRow icon="🗺️" title="Territory created" desc="D-3" time="5h ago" />
              <ActivityRow icon="⚠️" title="Status changed" desc="B-2 → Idle" time="1d ago" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Territories Content
function TerritoriesContent({ territories }: { territories: Territory[] }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-medium">All Territories</h3>
        <select className="bg-secondary text-sm rounded px-2 py-1 border border-border">
          <option>All Status</option>
          <option>Active</option>
          <option>Idle</option>
        </select>
      </div>
      <div className="divide-y divide-border">
        {territories.map((territory) => (
          <TerritoryRow key={territory.id} territory={territory} />
        ))}
      </div>
    </div>
  )
}

// Schedules Content
function SchedulesContent({ schedules }: { schedules: Schedule[] }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-medium">Weekly Schedules</h3>
      </div>
      <div className="divide-y divide-border">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="px-4 py-3 hover:bg-secondary/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{schedule.time_slot}</p>
                <p className="text-sm text-muted-foreground">{schedule.group_name || 'No group'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{schedule.leader || 'Unassigned'}</p>
                <span className={`text-xs ${schedule.is_active ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {schedule.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Reports Content
function ReportsContent() {
  return (
    <div className="bg-card border border-border rounded-lg p-8 text-center">
      <p className="text-muted-foreground">Reports feature coming soon...</p>
    </div>
  )
}

// Stat Card Component
function StatCard({ label, value, icon, color }: { 
  label: string
  value: number
  icon: string
  color?: 'green' | 'orange'
}) {
  const valueColor = color === 'green' ? 'text-green-500' : color === 'orange' ? 'text-orange-500' : 'text-foreground'
  
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

// Territory Row Component
function TerritoryRow({ territory }: { territory: Territory }) {
  const statusConfig = {
    active: { label: 'Active', color: 'bg-green-500/20 text-green-400' },
    idle: { label: 'Idle', color: 'bg-orange-500/20 text-orange-400' },
    completed: { label: 'Done', color: 'bg-muted text-muted-foreground' }
  }
  const config = statusConfig[territory.status as keyof typeof statusConfig] || statusConfig.active

  return (
    <div className="px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
            <span className="text-xs font-medium">{territory.code}</span>
          </div>
          <div>
            <p className="font-medium">{territory.responsible_brother || 'Unassigned'}</p>
            <p className="text-xs text-muted-foreground">
              {territory.days_idle !== null ? `${territory.days_idle} days idle` : 'No activity'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs ${config.color}`}>
            {config.label}
          </span>
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// Quick Action Button
function QuickActionButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button className="flex items-center gap-2 px-3 py-2 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors text-sm text-left">
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// Activity Row
function ActivityRow({ icon, title, desc, time }: { icon: string; title: string; desc: string; time: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{desc}</p>
      </div>
      <span className="text-xs text-muted-foreground">{time}</span>
    </div>
  )
}

// Icons
function OverviewIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

function TerritoryIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4v4l2.5 2.5" />
    </svg>
  )
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M5 5h6M5 8h6M5 11h3" />
    </svg>
  )
}
