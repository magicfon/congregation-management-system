import { prisma } from '@/lib/db'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

async function getStats() {
  const [areaCount, memberCount, scheduleCount, reportCount, recentAreas] = await Promise.all([
    prisma.area.count(),
    prisma.member.count(),
    prisma.schedule.count({ where: { status: 'scheduled' } }),
    prisma.report.count({ where: { status: 'pending' } }),
    prisma.area.findMany({
      orderBy: { lastActivityAt: 'asc' },
      take: 5,
      select: { id: true, name: true, lastActivityAt: true, assignedTo: true },
    }),
  ])
  return { areaCount, memberCount, scheduleCount, reportCount, recentAreas }
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
        <div className="bg-mc-card border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-mc-text">最久未活動區域</h2>
            <a href="/areas" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              查看全部 →
            </a>
          </div>

          {recentAreas.length === 0 ? (
            <p className="text-mc-text/40 text-sm text-center py-8">尚無區域資料</p>
          ) : (
            <div className="space-y-3">
              {recentAreas.map((area) => {
                const daysSince = Math.floor(
                  (Date.now() - new Date(area.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
                )
                const isIdle = daysSince >= 30
                return (
                  <div key={area.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isIdle ? 'bg-mc-warning' : 'bg-mc-success'}`} />
                      <div>
                        <div className="text-sm font-medium text-mc-text">{area.name}</div>
                        {area.assignedTo && (
                          <div className="text-xs text-mc-text/40">負責人：{area.assignedTo}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-medium ${isIdle ? 'text-mc-warning' : 'text-mc-text/50'}`}>
                        {formatDistanceToNow(new Date(area.lastActivityAt), { locale: zhTW, addSuffix: true })}
                      </div>
                      {isIdle && (
                        <div className="text-xs text-mc-warning/70 mt-0.5">閒置警告</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
