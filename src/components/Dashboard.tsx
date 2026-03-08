'use client'

import { useState, useEffect } from 'react'
import { Territory, Schedule, Report } from '@/types'
import AddTerritoryForm from './AddTerritoryForm'
import AddReportForm from './AddReportForm'

export default function Dashboard() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAddTerritory, setShowAddTerritory] = useState(false)
  const [showAddReport, setShowAddReport] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'idle' | 'stats'>('overview')

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
    if (days < 30) return 'text-green-600'
    if (days < 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              會眾傳道區域管理系統
            </h1>
            <div className="flex gap-2">
              <button
                onClick={loadData}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                🔄
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <p className="text-3xl font-bold text-blue-600">{basicStats.total}</p>
            <p className="text-sm text-gray-500 mt-1">總區域</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <p className="text-3xl font-bold text-green-600">{basicStats.active}</p>
            <p className="text-sm text-gray-500 mt-1">活躍區域</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
            <p className="text-3xl font-bold text-red-600">{basicStats.idle}</p>
            <p className="text-sm text-gray-500 mt-1">閒置區域</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <p className="text-3xl font-bold text-purple-600">{schedules.length}</p>
            <p className="text-sm text-gray-500 mt-1">排班時段</p>
          </div>
        </div>

        {/* Idle Warning */}
        {stats?.idleTerritories && stats.idleTerritories.length > 0 && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-orange-800">閒置區域警告</h3>
                <p className="text-sm text-orange-700 mt-1">
                  有 {stats.idleTerritories.length} 個區域超過 30 天未傳道
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {stats.idleTerritories.slice(0, 5).map((t: any) => (
                    <span key={t.code} className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                      {t.code} ({t.days_idle}天)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'overview', label: '📊 總覽' },
            { id: 'idle', label: '⚠️ 閒置區域' },
            { id: 'stats', label: '📈 統計' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Territories List */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-blue-600">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  🗺️ 區域列表
                  {loading && <span className="ml-2 animate-spin">⏳</span>}
                </h2>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="animate-pulse">載入中...</div>
                  </div>
                ) : territories.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <p>尚無區域資料</p>
                    <button
                      onClick={() => setShowAddTerritory(true)}
                      className="mt-2 text-blue-500 hover:underline"
                    >
                      新增第一個區域
                    </button>
                  </div>
                ) : (
                  territories.map((territory) => (
                    <div key={territory.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{territory.code}</p>
                          <p className="text-sm text-gray-500">{territory.responsible_brother || '未指派'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            territory.status === 'active' ? 'bg-green-100 text-green-700' :
                            territory.status === 'idle' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {territory.status === 'active' ? '活躍' : 
                             territory.status === 'idle' ? '閒置' : '已完成'}
                          </span>
                          {territory.days_idle !== null && (
                            <p className={`text-xs mt-1 ${getIdleColor(territory.days_idle)}`}>
                              {territory.days_idle} 天未傳
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Schedules */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6 border-b bg-gradient-to-r from-purple-500 to-purple-600">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  📅 排班系統
                  {loading && <span className="ml-2 animate-spin">⏳</span>}
                </h2>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="animate-pulse">載入中...</div>
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <p>尚無排班資料</p>
                  </div>
                ) : (
                  schedules.map((schedule) => (
                    <div key={schedule.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{schedule.time_slot}</p>
                          <p className="text-sm text-gray-500">{schedule.group_name || '未分組'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-700">{schedule.leader || '未指派'}</p>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            schedule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {schedule.is_active ? '啟用' : '停用'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'idle' && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b bg-gradient-to-r from-orange-500 to-red-500">
              <h2 className="text-lg font-semibold text-white">
                ⚠️ 閒置區域 ({stats?.idleTerritories?.length || 0})
              </h2>
            </div>
            <div className="divide-y">
              {stats?.idleTerritories?.length > 0 ? (
                stats.idleTerritories.map((t: any) => (
                  <div key={t.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{t.code}</p>
                        <p className="text-sm text-gray-500">{t.responsible_brother || '未指派'}</p>
                        {t.last_completed_date && (
                          <p className="text-xs text-gray-400">
                            最後完成: {new Date(t.last_completed_date).toLocaleDateString('zh-TW')}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          t.days_idle > 60 ? 'bg-red-100 text-red-700' :
                          t.days_idle > 30 ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {t.days_idle} 天未傳
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <p>🎉 太棒了！沒有閒置超過 30 天的區域</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">📊 區域統計</h3>
              {stats?.territories && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">總區域</span>
                    <span className="font-medium">{stats.territories.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">活躍</span>
                    <span className="font-medium text-green-600">{stats.territories.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">閒置</span>
                    <span className="font-medium text-red-600">{stats.territories.idle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">平均閒置天數</span>
                    <span className="font-medium">{stats.territories.avg_days_idle || 0} 天</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">📝 回報統計</h3>
              {stats?.reports && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">總回報</span>
                    <span className="font-medium">{stats.reports.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">本週</span>
                    <span className="font-medium text-blue-600">{stats.reports.this_week}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">本月</span>
                    <span className="font-medium text-purple-600">{stats.reports.this_month}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">⚡ 快速操作</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              onClick={() => setShowAddTerritory(true)}
              className="px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              ➕ 新增區域
            </button>
            <button 
              onClick={() => setShowAddReport(true)}
              className="px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
            >
              📝 新增回報
            </button>
            <button className="px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium">
              📅 管理排班
            </button>
            <button className="px-4 py-3 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium">
              📊 匯出報表
            </button>
          </div>
        </div>
      </div>

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
    </main>
  )
}
