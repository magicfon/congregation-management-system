export const dynamic = 'force-dynamic'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

async function getStats() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://congregation-management-system.vercel.app'}/api/statistics`, {
    cache: 'no-store'
  })
  
  if (!res.ok) {
    return {
      areaCount: 0,
      memberCount: 0,
      scheduleCount: 0,
      reportCount: 0,
      recentAreas: []
    }
  }
  
  return res.json()
}

export default async function DashboardPage() {
  const { areaCount, memberCount, scheduleCount, reportCount, recentAreas } = await getStats()

  const stats = [
    { label: '區域總數', value: areaCount, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: '成員數', value: memberCount, color: 'text-mc-success', bg: 'bg-mc-success/10 border-mc-success/20' },
    { label: '待執行排班', value: scheduleCount, color: 'text-mc-warning', bg: 'bg-mc-warning/10 border-mc-warning/20' },
    { label: '待審回報', value: reportCount, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ]

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-mc-text">儀表板</h1>
          <p className="text-mc-text/50 text-sm mt-1">會眾服務管理總覽</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className={`bg-mc-card border rounded-xl p-5 ${stat.bg}`}>
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-mc-text/60 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Recent idle areas */}
        <div className="bg-mc-card border border-mc-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-mc-text mb-4">閒置區域警告</h2>
          <div className="space-y-3">
            {recentAreas.length === 0 ? (
              <p className="text-mc-text/50 text-sm">暫無閒置區域</p>
            ) : (
              recentAreas.map((area: any) => {
                const daysInactive = Math.floor(
                  (Date.now() - new Date(area.lastactivityat).getTime()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <div key={area.id} className="flex items-center justify-between py-2 border-b border-mc-border last:border-0">
                    <div>
                      <div className="text-mc-text">{area.name}</div>
                      {area.assignedto && (
                        <div className="text-sm text-mc-text/50">負責人：{area.assignedto}</div>
                      )}
                    </div>
                    <div className="text-sm text-mc-warning">
                      {daysInactive > 30 ? (
                        <span className="text-red-400">已閒置 {daysInactive} 天</span>
                      ) : (
                        formatDistanceToNow(new Date(area.lastactivityat), {
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
