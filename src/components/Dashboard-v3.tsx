'use client'

import { useState, useEffect } from 'react'
import { Territory, Schedule } from '@/types'

export default function DashboardV3() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-black font-bold text-sm">C</span>
            </div>
            <span className="font-medium text-lg">Congregation</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
            <NavItem active>Dashboard</NavItem>
            <NavItem>Territories</NavItem>
            <NavItem>Schedules</NavItem>
            <NavItem>Reports</NavItem>
          </nav>

          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">
              Add Territory
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        {/* Hero Stats */}
        <div className="mb-12">
          <h1 className="text-4xl font-semibold mb-2">Dashboard</h1>
          <p className="text-neutral-400">Track and manage your congregation's territories</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <MetricCard 
            label="Total Territories"
            value={territories.length}
          />
          <MetricCard 
            label="Active"
            value={activeCount}
            highlight
          />
          <MetricCard 
            label="Idle"
            value={idleCount}
            warning={idleCount > 0}
          />
          <MetricCard 
            label="Schedules"
            value={schedules.length}
          />
        </div>

        {/* Alert Banner */}
        {stats?.idleTerritories?.length > 0 && (
          <div className="mb-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-orange-200">
                {stats.idleTerritories.length} territories have been idle for over 30 days
              </p>
            </div>
            <button className="text-sm text-orange-300 hover:text-orange-100 transition-colors">
              View all →
            </button>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Territories List */}
          <div className="lg:col-span-2">
            <div className="bg-neutral-900/50 border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-medium">Recent Territories</h2>
                <select className="bg-transparent text-sm text-neutral-400 border-none focus:ring-0">
                  <option>All Status</option>
                  <option>Active</option>
                  <option>Idle</option>
                </select>
              </div>
              
              {loading ? (
                <div className="p-12 text-center text-neutral-500">
                  Loading...
                </div>
              ) : territories.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                    <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <p className="text-neutral-400 mb-4">No territories yet</p>
                  <button className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">
                    Create First Territory
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {territories.map((territory) => (
                    <TerritoryItem key={territory.id} territory={territory} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6">
              <h3 className="font-medium mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <ActionButton icon="plus" label="Add Territory" />
                <ActionButton icon="document" label="New Report" />
                <ActionButton icon="calendar" label="Manage Schedule" />
                <ActionButton icon="download" label="Export Data" />
              </div>
            </div>

            {/* Activity */}
            <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6">
              <h3 className="font-medium mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <ActivityItem 
                  action="Report submitted"
                  target="Territory A-1"
                  time="2h ago"
                />
                <ActivityItem 
                  action="Territory created"
                  target="D-3"
                  time="5h ago"
                />
                <ActivityItem 
                  action="Status changed"
                  target="B-2 → Idle"
                  time="1d ago"
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// Components
function NavItem({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button className={`px-4 py-2 rounded-lg text-sm transition-colors ${
      active ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
    }`}>
      {children}
    </button>
  )
}

function MetricCard({ label, value, highlight, warning }: {
  label: string
  value: number
  highlight?: boolean
  warning?: boolean
}) {
  return (
    <div className="bg-neutral-900/50 border border-white/5 rounded-xl p-6">
      <p className="text-sm text-neutral-500 mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${
        highlight ? 'text-emerald-400' : warning ? 'text-orange-400' : 'text-white'
      }`}>
        {value}
      </p>
    </div>
  )
}

function TerritoryItem({ territory }: { territory: Territory }) {
  const statusStyles = {
    active: 'bg-emerald-500/20 text-emerald-400',
    idle: 'bg-orange-500/20 text-orange-400',
    completed: 'bg-neutral-500/20 text-neutral-400'
  }
  
  return (
    <div className="p-4 hover:bg-white/[0.02] transition-colors cursor-pointer group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
            <span className="text-xs font-medium">{territory.code}</span>
          </div>
          <div>
            <p className="font-medium">{territory.responsible_brother || 'Unassigned'}</p>
            {territory.days_idle !== null && (
              <p className="text-sm text-neutral-500">{territory.days_idle} days idle</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            statusStyles[territory.status as keyof typeof statusStyles]
          }`}>
            {territory.status}
          </span>
          <svg className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ icon, label }: { icon: string; label: string }) {
  const icons: Record<string, JSX.Element> = {
    plus: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
    document: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    calendar: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    download: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    )
  }

  return (
    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors text-left group">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-neutral-400 group-hover:text-white transition-colors">
        {icons[icon]}
      </div>
      <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">{label}</span>
    </button>
  )
}

function ActivityItem({ action, target, time }: { action: string; target: string; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-300">{action}</p>
        <p className="text-xs text-neutral-500">{target}</p>
      </div>
      <span className="text-xs text-neutral-600">{time}</span>
    </div>
  )
}
