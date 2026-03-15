'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'

interface Area {
  id: string
  name: string
  lastActivityAt: string
  assignedTo: string | null
}

interface Stats {
  areaCount: number
  memberCount: number
  scheduleCount: number
  reportCount: number
  recentAreas: Area[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get area count
        const { count: areaCount } = await supabase
          .from('areas')
          .select('id', { count: 'exact', head: true })

        // Get member count
        const { count: memberCount } = await supabase
          .from('members')
          .select('id', { count: 'exact', head: true })

        // Get scheduled count
        const { count: scheduleCount } = await supabase
          .from('schedules')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'scheduled')

        // Get pending reports count
        const { count: reportCount } = await supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')

        // Get recent areas
        const { data: recentAreas } = await supabase
          .from('areas')
          .select('id, name, lastActivityAt, assignedTo')
          .order('lastActivityAt', { ascending: true })
          .limit(5)

        setStats({
          areaCount: areaCount || 0,
          memberCount: memberCount || 0,
          scheduleCount: scheduleCount || 0,
          reportCount: reportCount || 0,
          recentAreas: recentAreas || []
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-mc-text-secondary">載入中...</div>
        </div>
      </DashboardLayout>
    )
  }

  if (!stats) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-mc-text-secondary">無法載入數據</div>
        </div>
      </DashboardLayout>
    )
  }

  const statsData = [
    { label: '區域總數', value: stats.areaCount, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: '成員數', value: stats.memberCount, color: 'text-mc-success', bg: 'bg-mc-success/10 border-mc-success/20' },
    { label: '待執行排班', value: stats.scheduleCount, color: 'text-mc-warning', bg: 'bg-mc-warning/10 border-mc-warning/20' },
    { label: '待審核回報', value: stats.reportCount, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  ]

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-mc-text mb-6">儀表板</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsData.map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bg} border rounded-lg p-6`}
            >
              <div className="text-mc-text-secondary text-sm mb-1">{stat.label}</div>
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-mc-card border border-mc-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-mc-text mb-4">閒置區域警告</h2>
          <div className="space-y-3">
            {stats.recentAreas.length === 0 ? (
              <div className="text-mc-text-secondary text-sm">暫無閒置區域</div>
            ) : (
              stats.recentAreas.map((area) => {
                const daysInactive = Math.floor(
                  (Date.now() - new Date(area.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <div key={area.id} className="flex items-center justify-between py-2 border-b border-mc-border last:border-0">
                    <div>
                      <div className="text-mc-text">{area.name}</div>
                      {area.assignedTo && (
                        <div className="text-sm text-mc-text-secondary">負責人：{area.assignedTo}</div>
                      )}
                    </div>
                    <div className="text-sm text-mc-warning">
                      {daysInactive > 30 ? (
                        <span className="text-red-400">
                          已閒置 {daysInactive} 天
                        </span>
                      ) : (
                        formatDistanceToNow(new Date(area.lastActivityAt), {
                          addSuffix: true,
                          locale: zhTW,
                        })
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
