import DashboardLayout from '../../components/layout/DashboardLayout'
import ScheduleManager from '../../components/schedule/ScheduleManager'

export const dynamic = 'force-dynamic'

export default function SchedulesPage() {
  return (
    <DashboardLayout>
      <div className="p-4 md:p-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-mc-text">傳道行程</h1>
          <p className="text-mc-text/50 text-sm mt-1">管理傳道排程與區域回報</p>
        </div>

        <ScheduleManager />
      </div>
    </DashboardLayout>
  )
}
