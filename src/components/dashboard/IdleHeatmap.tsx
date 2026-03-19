'use client'

import { useEffect, useState } from 'react'

interface IdleStat {
  areaId: string
  areaName: string
  idleDays: number
  status: 'green' | 'yellow' | 'orange' | 'red'
  assignedTo: string | null
  lastActivityAt: string | null
}

const statusConfig = {
  green: {
    bg: 'bg-emerald-500/20 hover:bg-emerald-500/30',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    label: '活躍',
    emoji: '🟢'
  },
  yellow: {
    bg: 'bg-yellow-500/20 hover:bg-yellow-500/30',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    label: '稍久未活動',
    emoji: '🟡'
  },
  orange: {
    bg: 'bg-orange-500/20 hover:bg-orange-500/30',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    label: '久未活動',
    emoji: '🟠'
  },
  red: {
    bg: 'bg-red-500/20 hover:bg-red-500/30',
    border: 'border-red-500/30',
    text: 'text-red-400',
    label: '嚴重閒置',
    emoji: '🔴'
  }
}

export default function IdleHeatmap() {
  const [stats, setStats] = useState<IdleStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/areas/idle-stats')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setStats(data)
        }
      })
      .catch(err => {
        setError('載入失敗')
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4">
            <div className="h-4 bg-white/10 rounded w-1/4"></div>
            <div className="grid grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-20 bg-white/5 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  const statusCounts = {
    green: stats.filter(s => s.status === 'green').length,
    yellow: stats.filter(s => s.status === 'yellow').length,
    orange: stats.filter(s => s.status === 'orange').length,
    red: stats.filter(s => s.status === 'red').length
  }

  return (
    <div className="bg-mc-card border border-white/5 rounded-xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base md:text-lg font-semibold text-mc-text">區域閒置時間熱力圖</h2>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            &lt;7天
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            7-30天
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
            30-90天
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            &gt;90天
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-4 text-sm">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="flex items-center gap-1">
            <span>{statusConfig[status as keyof typeof statusConfig].emoji}</span>
            <span className="text-mc-text/60">{count}</span>
          </div>
        ))}
      </div>

      {/* Heatmap Grid */}
      {stats.length === 0 ? (
        <p className="text-mc-text/50 text-sm">暫無區域資料</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {stats.map(stat => {
            const config = statusConfig[stat.status]
            return (
              <div
                key={stat.areaId}
                className={`relative group p-3 rounded-lg border transition-all cursor-pointer ${config.bg} ${config.border}`}
              >
                <div className="text-sm font-medium text-mc-text truncate">{stat.areaName}</div>
                <div className={`text-lg font-bold ${config.text}`}>{stat.idleDays}天</div>
                
                {/* Tooltip */}
                <div className="absolute z-10 left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block">
                  <div className="bg-mc-dark border border-white/10 rounded-lg p-3 shadow-xl min-w-[180px]">
                    <div className="text-sm font-medium text-mc-text mb-2">{stat.areaName}</div>
                    <div className="space-y-1 text-xs text-mc-text/60">
                      <div className="flex justify-between">
                        <span>狀態</span>
                        <span className={config.text}>{config.label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>閒置天數</span>
                        <span className="text-mc-text">{stat.idleDays} 天</span>
                      </div>
                      {stat.assignedTo && (
                        <div className="flex justify-between">
                          <span>負責人</span>
                          <span className="text-mc-text">{stat.assignedTo}</span>
                        </div>
                      )}
                      {stat.lastActivityAt && (
                        <div className="flex justify-between">
                          <span>最後活動</span>
                          <span className="text-mc-text">
                            {new Date(stat.lastActivityAt).toLocaleDateString('zh-TW')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
