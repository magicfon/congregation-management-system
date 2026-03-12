'use client'

import { useState, useEffect } from 'react'
import { Territory, Schedule, Report } from '@/types'
import { NavRail } from './NavRail'
import { MetricCard, MetricGrid } from './MetricCard'
import AddTerritoryForm from './AddTerritoryForm'
import AddReportForm from './AddReportForm'

export default function DashboardNew() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAddTerritory, setShowAddTerritory] = useState(false)
  const [showAddReport, setShowAddReport] = useState(false)

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

  const basicStats = {
    total: territories.length,
    active: territories.filter(t => t.status === 'active').length,
    idle: territories.filter(t => t.status === 'idle').length,
    completed: territories.filter(t => t.status === 'completed').length
  }

  const getIdleColor = (days: number) => {
    if (days < 30) return 'text-green-400'
    if (days < 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge-success px-2 py-1 rounded text-xs">活躍</span>
      case 'idle':
        return <span className="badge-error px-2 py-1 rounded text-xs">閒置</span>
      default:
        return <span className="badge-neutral px-2 py-1 rounded text-xs">已完成</span>
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <NavRail activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-lg border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">會眾傳道區域管理系統</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Congregation Territory Management</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                title="重新載入"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}>
                  <path d="M1 8a7 7 0 0112.5-4.3M15 8a7 7 0 01-12.5 4.3" strokeLinecap="round" />
                  <path d="M14 2v3h-3M2 14v-3h3" strokeLinecap="round" />
                </svg>
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
                <span className="text-xs text-muted-foreground">系統正常</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6 pb-20 md:pb-6">
          {/* Idle Warning */}
          {stats?.idleTerritories && stats.idleTerritories.length > 0 && (
            <div className="glass-strong rounded-lg p-4 border-l-4 border-yellow-500">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">閒置區域警告</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    有 <span className="text-yellow-400 font-medium">{stats.idleTerritories.length}</span> 個區域超過 30 天未傳道
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {stats.idleTerritories.slice(0, 5).map((t: any) => (
                      <span key={t.code} className="px-2 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded text-xs font-mono-tight">
                        {t.code} ({t.days_idle}天)
                      </span>
                    ))}
                    {stats.idleTerritories.length > 5 && (
                      <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
                        +{stats.idleTerritories.length - 5} 更多
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <MetricGrid columns={4}>
            <MetricCard
              title="總區域"
              value={basicStats.total}
              icon="🗺️"
              color="default"
              onClick={() => setActiveTab('territories')}
            />
            <MetricCard
              title="活躍區域"
              value={basicStats.active}
              icon="✅"
              subtitle={`${basicStats.total > 0 ? Math.round((basicStats.active / basicStats.total) * 100) : 0}% 活躍率`}
              color="success"
              trend="up"
            />
            <MetricCard
              title="閒置區域"
              value={basicStats.idle}
              icon="⚠️"
              color={basicStats.idle > 0 ? 'warning' : 'default'}
              onClick={() => setActiveTab('territories')}
            />
            <MetricCard
              title="排班時段"
              value={schedules.length}
              icon="📅"
              color="info"
              onClick={() => setActiveTab('schedules')}
            />
          </MetricGrid>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAddTerritory(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 transition-all"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M8 2v12M2 8h12" strokeLinecap="round" />
              </svg>
              <span className="text-sm font-medium">新增區域</span>
            </button>
            <button
              onClick={() => setShowAddReport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-all"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M2 3h12v10H2z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 7h6M5 10h3" strokeLinecap="round" />
              </svg>
              <span className="text-sm font-medium">新增報告</span>
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-all"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 4v4l2.5 2.5" strokeLinecap="round" />
              </svg>
              <span className="text-sm font-medium">管理排班</span>
            </button>
          </div>

          {/* Main Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Territories Panel */}
            <div className="panel">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🗺️</span>
                  <h2 className="font-semibold text-foreground">區域列表</h2>
                </div>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                  {territories.length} 個
                </span>
              </div>
              <div className="panel-body max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-muted-foreground text-sm">載入中...</div>
                  </div>
                ) : territories.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground text-sm">尚無區域資料</p>
                    <button
                      onClick={() => setShowAddTerritory(true)}
                      className="mt-2 text-primary text-sm hover:underline"
                    >
                      新增第一個區域
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {territories.slice(0, 10).map((territory) => (
                      <div
                        key={territory.id}
                        className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-tight font-medium text-foreground">
                              {territory.code}
                            </span>
                            {getStatusBadge(territory.status)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {territory.responsible_brother || '未指派'}
                          </p>
                        </div>
                        {territory.days_idle !== null && (
                          <div className="text-right">
                            <span className={`text-xs font-mono-tight ${getIdleColor(territory.days_idle)}`}>
                              {territory.days_idle}天
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {territories.length > 10 && (
                      <div className="text-center py-2">
                        <button
                          onClick={() => setActiveTab('territories')}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          查看全部 {territories.length} 個區域 →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Schedules Panel */}
            <div className="panel">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📅</span>
                  <h2 className="font-semibold text-foreground">排班系統</h2>
                </div>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                  {schedules.length} 個時段
                </span>
              </div>
              <div className="panel-body max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-muted-foreground text-sm">載入中...</div>
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground text-sm">尚無排班資料</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schedules.slice(0, 10).map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {schedule.time_slot}
                            </span>
                            {schedule.is_active ? (
                              <span className="badge-success px-2 py-0.5 rounded text-xs">啟用</span>
                            ) : (
                              <span className="badge-neutral px-2 py-0.5 rounded text-xs">停用</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {schedule.group_name || '未分組'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {schedule.leader || '未指派'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Section */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Territory Stats */}
              <div className="panel">
                <div className="panel-header">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <h2 className="font-semibold text-foreground">區域統計</h2>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">總區域</span>
                      <span className="font-mono-tight font-medium text-foreground">
                        {stats.territories?.total || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">活躍</span>
                      <span className="font-mono-tight font-medium text-green-400">
                        {stats.territories?.active || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">閒置</span>
                      <span className="font-mono-tight font-medium text-red-400">
                        {stats.territories?.idle || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">平均閒置天數</span>
                      <span className="font-mono-tight font-medium text-foreground">
                        {stats.territories?.avg_days_idle || 0} 天
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Stats */}
              <div className="panel">
                <div className="panel-header">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📝</span>
                    <h2 className="font-semibold text-foreground">報告統計</h2>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">總報告</span>
                      <span className="font-mono-tight font-medium text-foreground">
                        {stats.reports?.total || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">本週</span>
                      <span className="font-mono-tight font-medium text-blue-400">
                        {stats.reports?.this_week || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">本月</span>
                      <span className="font-mono-tight font-medium text-purple-400">
                        {stats.reports?.this_month || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">活躍傳道員</span>
                      <span className="font-mono-tight font-medium text-foreground">
                        {stats.reports?.active_publishers || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showAddTerritory && (
        <AddTerritoryForm
          onSuccess={() => {
            setShowAddTerritory(false)
            loadData()
          }}
          onCancel={() => setShowAddTerritory(false)}
        />
      )}
      
      {showAddReport && (
        <AddReportForm
          onSuccess={() => {
            setShowAddReport(false)
            loadData()
          }}
          onCancel={() => setShowAddReport(false)}
        />
      )}
    </div>
  )
}
